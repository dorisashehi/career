import re
from datetime import datetime
from typing import Dict, List

from transformers import pipeline


toxicity_pipeline = None
relevance_pipeline = None


# This function builds simple keyword lists
def _get_keywords() -> Dict[str, List[str]]:
    return {
        "hate": [
            "idiot",
            "stupid",
            "dumb",
            "loser",
        ],
        "threats": [
            "kill you",
            "hurt you",
            "destroy you",
        ],
        "self_harm": [
            "end my life",
            "kill myself",
        ],
        "illegal_advice": [
            "lie on my resume",
            "lie on your resume",
            "fake experience",
            "cheat the test",
            "cheat the interview",
            "bribe",
            "insider info",
            "insider information",
        ],
        "promo": [
            "promo code",
            "discount",
            "affiliate",
            "sign up here",
            "dm me",
        ]
    }


def _get_toxicity_pipeline():
    global toxicity_pipeline
    if toxicity_pipeline is None:
        toxicity_pipeline = pipeline(
            "text-classification",
            # Smaller, faster toxicity model (vs large BERT variants)
            model="SkolkovoInstitute/roberta_toxicity_classifier",
            truncation=True,
        )
    return toxicity_pipeline


def _get_relevance_pipeline():
    global relevance_pipeline
    if relevance_pipeline is None:
        relevance_pipeline = pipeline(
            "zero-shot-classification",
            # Distilled MNLI model: ~3–6× faster than bart-large-mnli
            model="valhalla/distilbart-mnli-12-3",
            truncation=True,
        )
    return relevance_pipeline

# This function checks for safety and policy problems
def check_safety(text: str) -> Dict:
    keywords = _get_keywords()
    lowered = text.lower()

    reasons = []
    is_critical = False

    for word in keywords["hate"]:
        if word in lowered:
            reasons.append("hate / harassment language (keyword)")
            is_critical = True
            break

    for phrase in keywords["threats"]:
        if phrase in lowered:
            reasons.append("threatening language (keyword)")
            is_critical = True
            break

    for phrase in keywords["self_harm"]:
        if phrase in lowered:
            reasons.append("self-harm language (keyword)")
            is_critical = True
            break

    for phrase in keywords["illegal_advice"]:
        if phrase in lowered:
            reasons.append("illegal or unethical advice (keyword)")
            is_critical = True
            break

    model_flagged = False
    try:
        clf = _get_toxicity_pipeline()
        result = clf(text[:512])[0]
        label = result.get("label", "").lower()
        score = float(result.get("score", 0.0))

        if ("toxic" in label or "negative" in label) and score >= 0.7:
            model_flagged = True
            reasons.append(f"model flagged text as {label} (score {score:.2f})")
    except Exception:
        pass

    if model_flagged:
        is_critical = True

    return {
        "is_critical": is_critical,
        "reasons": reasons,
    }


# This function finds and redacts PII like email, phone, urls
def check_pii(text: str) -> Dict:
    email_pattern = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
    phone_pattern = re.compile(r"\b\+?\d[\d\-\s]{7,}\d\b")
    url_pattern = re.compile(r"(https?://\S+|www\.\S+)")

    cleaned = text
    had_pii = False

    if email_pattern.search(cleaned):
        cleaned = email_pattern.sub("[EMAIL]", cleaned)
        had_pii = True

    if phone_pattern.search(cleaned):
        cleaned = phone_pattern.sub("[PHONE]", cleaned)
        had_pii = True

    if url_pattern.search(cleaned):
        cleaned = url_pattern.sub("[URL]", cleaned)
        had_pii = True

    reasons = []
    if had_pii:
        reasons.append("contains PII (auto-redacted)")

    return {
        "cleaned_text": cleaned,
        "had_pii": had_pii,
        "reasons": reasons,
    }


# This function checks if text looks like spam or promotion
def check_spam(text: str) -> Dict:
    keywords = _get_keywords()
    lowered = text.lower()

    url_pattern = re.compile(r"(https?://\S+|www\.\S+)")
    urls = url_pattern.findall(text)

    is_spam = False
    reasons = []

    if len(urls) >= 2:
        is_spam = True
        reasons.append("many links (possible promotion)")

    for word in keywords["promo"]:
        if word in lowered:
            is_spam = True
            reasons.append("promotional language")
            break

    if not is_spam and len(urls) == 1:
        reasons.append("contains link (needs review)")

    return {
        "is_spam": is_spam,
        "reasons": reasons,
    }


# This function checks if the text is career related or off-topic
def check_relevance(text: str) -> Dict:
    # Strip surrounding quotes if the entire text is wrapped in quotes
    # This helps detect quoted examples/resume content
    cleaned_text = text.strip()
    if (cleaned_text.startswith('"') and cleaned_text.endswith('"')) or \
       (cleaned_text.startswith("'") and cleaned_text.endswith("'")):
        cleaned_text = cleaned_text[1:-1].strip()

    clf = _get_relevance_pipeline()

    labels = [
        "career or job experience in tech",
        "interview preparation or job search",
        "professional growth or learning",
        "unrelated personal topic",
        "advertising or promotion",
    ]

    # Use cleaned text (without quotes) for classification
    result = clf(
        cleaned_text[:512],
        candidate_labels=labels,
        hypothesis_template="This text is about {}.",
    )

    scores = dict(zip(result["labels"], result["scores"]))

    career_score = max(
        scores.get("career or job experience in tech", 0),
        scores.get("interview preparation or job search", 0),
        scores.get("professional growth or learning", 0),
    )

    lowered = cleaned_text.lower()
    career_keywords = [
        "job", "work", "career", "internship", "interview",
        "resume", "cv", "promotion", "manager", "software engineer",
        "developer", "programmer", "data scientist", "tech company",
        "startup", "team lead", "product manager",
    ]
    has_career_words = any(word in lowered for word in career_keywords)

    # 2. Career score is too low
    # 3. No career-related words found
    off_topic = (career_score < 0.45) or (not has_career_words)

    reasons: List[str] = []
    if not has_career_words:
        reasons.append("may be off-topic (no career-related words found)")
    elif off_topic:
        reasons.append(f"may be off-topic (career relevance score {career_score:.2f})")

    return {
        "is_off_topic": off_topic,
        "reasons": reasons,
    }

# This function runs all checks and builds a final decision
def validate_experience(text: str) -> Dict:
    now = datetime.utcnow()

    pii_result = check_pii(text)
    cleaned_text = pii_result["cleaned_text"]

    safety_result = check_safety(cleaned_text)
    spam_result = check_spam(cleaned_text)
    relevance_result = check_relevance(cleaned_text)

    all_reasons: List[str] = []
    all_reasons.extend(pii_result["reasons"])
    all_reasons.extend(safety_result["reasons"])
    all_reasons.extend(spam_result["reasons"])
    all_reasons.extend(relevance_result["reasons"])

    severity = None
    # Default to approved - only set to pending if there are issues
    status = "approved"
    flagged_at = None

    # Check if there are any issues that need review
    if safety_result["is_critical"]:
        severity = "critical"
        status = "pending"
        flagged_at = now
    elif spam_result["is_spam"]:
        severity = "medium"
        status = "pending"
        flagged_at = now
    elif relevance_result["is_off_topic"]:
        severity = "low"
        status = "pending"
        flagged_at = now
    elif pii_result["had_pii"]:
        severity = "medium"
        status = "pending"
        flagged_at = now

    flagged_reason = None
    if all_reasons:
        flagged_reason = "; ".join(all_reasons)

    return {
        "cleaned_text": cleaned_text,
        "status": status,
        "severity": severity,
        "flagged_reason": flagged_reason,
        "flagged_at": flagged_at,
    }


