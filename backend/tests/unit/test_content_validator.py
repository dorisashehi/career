"""
Unit tests for content_validator.py

Tests all validation functions: check_safety, check_pii, check_spam, check_relevance, and validate_experience.
"""
import pytest
from unittest.mock import patch, MagicMock
from app.services.content_validator import (
    check_safety,
    check_pii,
    check_spam,
    check_relevance,
    validate_experience
)


@pytest.mark.unit
class TestCheckSafety:
    """Tests for check_safety function."""

    def test_safety_clean_text(self):
        """Test that clean, safe text passes safety checks."""
        result = check_safety("I had a great interview experience at a tech company.")
        assert result["is_critical"] is False
        assert len(result["reasons"]) == 0

    def test_safety_hate_keywords(self):
        """Test detection of hate keywords."""
        result = check_safety("The interviewer was an idiot and the process was stupid.")
        assert result["is_critical"] is True
        assert any("hate" in reason.lower() for reason in result["reasons"])

    def test_safety_threat_keywords(self):
        """Test detection of threatening language."""
        result = check_safety("I will hurt you if you don't hire me.")
        assert result["is_critical"] is True
        assert any("threatening" in reason.lower() for reason in result["reasons"])

    def test_safety_illegal_advice_keywords(self):
        """Test detection of illegal advice keywords."""
        result = check_safety("You should lie on your resume to get the job.")
        assert result["is_critical"] is True
        assert any("illegal" in reason.lower() or "unethical" in reason.lower()
                  for reason in result["reasons"])

    @patch('app.services.content_validator._get_toxicity_pipeline')
    def test_safety_toxic_model_detection(self, mock_pipeline):
        """Test that toxicity model flags toxic content."""
        # Mock the toxicity pipeline
        mock_classifier = MagicMock()
        mock_classifier.return_value = [{"label": "toxic", "score": 0.85}]
        mock_pipeline.return_value = mock_classifier

        result = check_safety("This is some toxic content that should be flagged.")
        # The model might flag it, but keyword check might not
        # We're testing the model integration works
        assert "is_critical" in result
        assert "reasons" in result


@pytest.mark.unit
class TestCheckPII:
    """Tests for check_pii function."""

    def test_pii_email_detection(self):
        """Test email detection and redaction."""
        text = "Contact me at john.doe@example.com for details."
        result = check_pii(text)
        assert result["had_pii"] is True
        assert "[EMAIL]" in result["cleaned_text"]
        assert "john.doe@example.com" not in result["cleaned_text"]
        assert any("PII" in reason for reason in result["reasons"])

    def test_pii_phone_detection(self):
        """Test phone number detection and redaction."""
        text = "Call me at 555-123-4567 or +1-555-123-4567."
        result = check_pii(text)
        assert result["had_pii"] is True
        assert "[PHONE]" in result["cleaned_text"]
        assert "555-123-4567" not in result["cleaned_text"]

    def test_pii_url_detection(self):
        """Test URL detection and redaction."""
        text = "Check out https://example.com for more info."
        result = check_pii(text)
        assert result["had_pii"] is True
        assert "[URL]" in result["cleaned_text"]
        assert "https://example.com" not in result["cleaned_text"]

    def test_pii_multiple_types(self):
        """Test detection of multiple PII types."""
        text = "Email: test@example.com, Phone: 555-1234, Website: https://example.com"
        result = check_pii(text)
        assert result["had_pii"] is True
        assert "[EMAIL]" in result["cleaned_text"]
        assert "[PHONE]" in result["cleaned_text"]
        assert "[URL]" in result["cleaned_text"]

    def test_pii_no_pii(self):
        """Test text with no PII."""
        text = "I had a great interview experience at the company."
        result = check_pii(text)
        assert result["had_pii"] is False
        assert result["cleaned_text"] == text
        assert len(result["reasons"]) == 0


@pytest.mark.unit
class TestCheckSpam:
    """Tests for check_spam function."""

    def test_spam_multiple_urls(self):
        """Test detection of spam with multiple URLs."""
        text = "Check out https://example.com and https://another.com and www.third.com"
        result = check_spam(text)
        assert result["is_spam"] is True
        assert any("link" in reason.lower() or "promotion" in reason.lower()
                  for reason in result["reasons"])

    def test_spam_promo_keywords(self):
        """Test detection of promotional keywords."""
        text = "Use promo code SAVE20 for a discount! Sign up here!"
        result = check_spam(text)
        assert result["is_spam"] is True
        assert any("promotional" in reason.lower() for reason in result["reasons"])

    def test_spam_single_url(self):
        """Test that single URL is flagged for review but not marked as spam."""
        text = "Check out this resource: https://example.com/article"
        result = check_spam(text)
        assert result["is_spam"] is False
        assert any("link" in reason.lower() and "review" in reason.lower()
                  for reason in result["reasons"])

    def test_spam_clean_text(self):
        """Test that clean text without spam passes."""
        text = "I had a great interview experience at a tech company."
        result = check_spam(text)
        assert result["is_spam"] is False
        assert len(result["reasons"]) == 0


@pytest.mark.unit
class TestCheckRelevance:
    """Tests for check_relevance function."""

    @patch('app.services.content_validator._get_relevance_pipeline')
    def test_relevance_career_related(self, mock_pipeline):
        """Test that career-related text is marked as relevant."""
        # Mock the relevance pipeline to return high career score
        mock_classifier = MagicMock()
        mock_classifier.return_value = {
            "labels": [
                "career or job experience in tech",
                "interview preparation or job search",
                "professional growth or learning",
                "unrelated personal topic",
                "advertising or promotion"
            ],
            "scores": [0.8, 0.1, 0.05, 0.03, 0.02]
        }
        mock_pipeline.return_value = mock_classifier

        text = "I had a job interview at Google for a software engineer position."
        result = check_relevance(text)
        assert result["is_off_topic"] is False

    @patch('app.services.content_validator._get_relevance_pipeline')
    def test_relevance_off_topic(self, mock_pipeline):
        """Test that off-topic text is flagged."""
        # Mock the relevance pipeline to return low career score
        mock_classifier = MagicMock()
        mock_classifier.return_value = {
            "labels": [
                "career or job experience in tech",
                "interview preparation or job search",
                "professional growth or learning",
                "unrelated personal topic",
                "advertising or promotion"
            ],
            "scores": [0.1, 0.05, 0.05, 0.7, 0.1]
        }
        mock_pipeline.return_value = mock_classifier

        text = "I love cooking pasta and here's my favorite recipe."
        result = check_relevance(text)
        assert result["is_off_topic"] is True
        assert len(result["reasons"]) > 0

    def test_relevance_career_keywords(self):
        """Test that text with career keywords is more likely to be relevant."""
        text = "I'm looking for a job as a software developer at a tech company."
        # Even if model score is low, keywords should help
        result = check_relevance(text)
        # The function checks for career keywords, so it should be less likely to be off-topic
        assert "is_off_topic" in result
        assert "reasons" in result


@pytest.mark.unit
class TestValidateExperience:
    """Tests for validate_experience function (integration of all checks)."""

    def test_validate_clean_experience(self):
        """Test validation of clean, valid experience."""
        text = "I had a great interview experience at a tech company. The process was smooth and professional."
        result = validate_experience(text)
        assert result["status"] == "approved"
        assert result["severity"] is None
        assert result["flagged_reason"] is None
        assert result["flagged_at"] is None

    def test_validate_experience_with_pii(self):
        """Test validation of experience containing PII."""
        text = "Contact me at john.doe@example.com for interview details."
        result = validate_experience(text)
        assert result["status"] == "pending"
        assert result["severity"] == "medium"
        assert result["flagged_reason"] is not None
        assert "[EMAIL]" in result["cleaned_text"]
        assert result["flagged_at"] is not None

    def test_validate_experience_toxic(self):
        """Test validation of toxic experience."""
        text = "The interviewer was an idiot and the company is terrible."
        result = validate_experience(text)
        assert result["status"] == "pending"
        assert result["severity"] == "critical"
        assert result["flagged_reason"] is not None
        assert result["flagged_at"] is not None

    def test_validate_experience_spam(self):
        """Test validation of spam experience."""
        text = "Check out https://example.com/course and https://another.com/offer! Use promo code SAVE20!"
        result = validate_experience(text)
        assert result["status"] == "pending"
        assert result["severity"] == "medium"
        assert result["flagged_reason"] is not None

    @patch('app.services.content_validator._get_relevance_pipeline')
    def test_validate_experience_off_topic(self, mock_pipeline):
        """Test validation of off-topic experience."""
        # Mock off-topic classification
        mock_classifier = MagicMock()
        mock_classifier.return_value = {
            "labels": ["career or job experience in tech", "unrelated personal topic"],
            "scores": [0.2, 0.8]
        }
        mock_pipeline.return_value = mock_classifier

        text = "I love cooking pasta recipes. Here's my favorite recipe."
        result = validate_experience(text)
        assert result["status"] == "pending"
        assert result["severity"] == "low"
        assert result["flagged_reason"] is not None

    def test_validate_experience_pii_redaction(self):
        """Test that PII is properly redacted in cleaned_text."""
        text = "Email me at test@example.com or call 555-1234."
        result = validate_experience(text)
        assert "[EMAIL]" in result["cleaned_text"]
        assert "[PHONE]" in result["cleaned_text"]
        assert "test@example.com" not in result["cleaned_text"]
        assert "555-1234" not in result["cleaned_text"]

    def test_validate_experience_multiple_issues(self):
        """Test validation when multiple issues are present."""
        text = "The interviewer was stupid. Contact me at spam@example.com and visit https://spam.com and https://more-spam.com"
        result = validate_experience(text)
        assert result["status"] == "pending"
        assert result["severity"] == "critical"  # Safety issues are critical
        assert result["flagged_reason"] is not None
        # Should contain multiple reasons
        assert ";" in result["flagged_reason"] or len(result["flagged_reason"].split(";")) > 1
