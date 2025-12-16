"""Clean Reddit data by removing usernames, URLs, emojis, and irrelevant comments."""
import re
import pandas as pd


def remove_urls(text):
    """Remove URLs from text."""
    # Remove http/https URLs
    text = re.sub(r'http\S+|www.\S+', '', text)
    # Remove reddit-style links like r/subreddit or u/username
    text = re.sub(r'r/\w+', '', text)
    text = re.sub(r'u/\w+', '', text)
    return text.strip()


def remove_usernames(text):
    """Remove @username mentions."""
    # Remove @username patterns
    text = re.sub(r'@\w+', '', text)
    return text.strip()


def remove_emojis(text):
    """Remove emojis from text."""
    # Emoji pattern - covers most common emojis
    emoji_pattern = re.compile(
        "["
        u"\U0001F600-\U0001F64F"  # emoticons
        u"\U0001F300-\U0001F5FF"  # symbols & pictographs
        u"\U0001F680-\U0001F6FF"  # transport & map symbols
        u"\U0001F1E0-\U0001F1FF"  # flags (iOS)
        u"\U00002500-\U00002BEF"  # chinese char
        u"\U00002702-\U000027B0"
        u"\U000024C2-\U0001F251"
        u"\U0001f926-\U0001f937"
        u"\U00010000-\U0010ffff"
        u"\u2640-\u2642"
        u"\u2600-\u2B55"
        u"\u200d"
        u"\u23cf"
        u"\u23e9"
        u"\u231a"
        u"\ufe0f"  # dingbats
        u"\u3030"
        "]+",
        flags=re.UNICODE
    )
    return emoji_pattern.sub(r'', text)


def remove_ambiguous_unicode(text):
    """Remove ambiguous unicode characters and special symbols."""
    # Remove zero-width characters
    text = re.sub(r'[\u200b-\u200f\u202a-\u202e\ufeff]', '', text)

    # Remove control characters except newline, tab, carriage return
    text = re.sub(r'[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f-\x9f]', '', text)

    # Remove other problematic unicode ranges
    text = re.sub(r'[\uf000-\uf8ff]', '', text)  # Private use area
    text = re.sub(r'[\U000e0000-\U000e007f]', '', text)  # Tags

    # Replace non-breaking spaces with regular spaces
    text = text.replace('\u00a0', ' ')
    text = text.replace('\u202f', ' ')

    # Remove bullet points, arrows, and special symbols
    text = re.sub(r'[•·●○■□▪▫‣⁃◦⦾⦿►▸▹▻◄◂◃◅→←↑↓↔↕⇒⇐⇑⇓⇔⇕]', '', text)

    return text


def is_irrelevant_comment(text, min_length=20):
    """
    Check if comment is irrelevant based on:
    - Too short (less than min_length characters)
    - Only contains common filler phrases
    - Is deleted/removed
    """
    if not text or len(text.strip()) < min_length:
        return True

    text_lower = text.lower().strip()

    # Check for deleted/removed content
    irrelevant_phrases = [
        '[deleted]',
        '[removed]',
        'deleted',
        'removed',
        'this',
        'lol',
        'lmao',
        'haha',
        'thanks',
        'thank you',
        'nice',
        'good',
        'same',
        'agreed',
        'this.',
        '^this',
        'edit:',
        'edit :',
    ]

    # If the entire comment is just one of these phrases
    if text_lower in irrelevant_phrases:
        return True

    # If comment is very short and only contains common words
    words = text_lower.split()
    if len(words) <= 3:
        common_words = {'the', 'a', 'an', 'this', 'that', 'is', 'was', 'are', 'be', 'it'}
        if all(word in common_words for word in words):
            return True

    return False


def clean_text(text):
    """Apply all cleaning operations to text."""
    if pd.isna(text):
        return ""

    # Convert to string
    text = str(text)

    # Apply cleaning operations in order
    #text = remove_urls(text)
    text = remove_usernames(text)
    text = remove_emojis(text)
    text = remove_ambiguous_unicode(text)

    # Remove extra whitespace
    text = ' '.join(text.split())

    return text.strip()


def clean_posts_df(df, min_text_length=10):
    if df.empty:
        return df

    initial_count = len(df)
    text_columns = ['title', 'text', 'full_text']

    for col in text_columns:
        if col in df.columns:
            df[col] = df[col].apply(clean_text)

    if 'text' in df.columns:
        df = df[df['text'].str.len() >= min_text_length]

    if 'title' in df.columns:
        df = df[df['title'].str.len() > 0]

    removed_count = initial_count - len(df)
    print(f"   Cleaned {initial_count} posts")
    print(f"   Removed {removed_count} posts")
    print(f"   Kept {len(df)} posts")

    return df


def clean_comments_df(df, min_text_length=20):
    if df.empty:
        return df

    initial_count = len(df)

    if 'text' in df.columns:
        df['text'] = df['text'].apply(clean_text)
        df = df[~df['text'].apply(lambda x: is_irrelevant_comment(x, min_text_length))]

    removed_count = initial_count - len(df)
    print(f"   Cleaned {initial_count} comments")
    print(f"   Removed {removed_count} comments")
    print(f"   Kept {len(df)} comments")

    return df


if __name__ == "__main__":
    print("This script provides DataFrame cleaning functions.")
    print("Use clean_posts_df() and clean_comments_df() functions.")