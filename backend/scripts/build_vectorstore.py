"""Build and save FAISS vector store from cleaned Reddit data."""
import os
import pandas as pd
from dotenv import load_dotenv
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.schema import Document

load_dotenv()

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)  # go one level up

persistent_directory = os.path.join(parent_dir, "data", "faiss_index")
posts_csv = os.path.join(parent_dir, "data", "processed", "posts_cleaned.csv")
comments_csv = os.path.join(parent_dir, "data", "processed", "comments_cleaned.csv")

def combine_posts_with_comments(max_comments_per_post=10):
    """
    Combine posts with their comments into single documents.

    Args:
        max_comments_per_post: Maximum comments to include per post

    Returns:
        List of LangChain Document objects
    """
    print("\n📂 Loading and combining posts with comments...")

    # Load data
    posts_df = pd.read_csv(posts_csv)
    comments_df = pd.read_csv(comments_csv)

    print(f"   ✅ Loaded {len(posts_df)} posts")
    print(f"   ✅ Loaded {len(comments_df)} comments")

    # Group comments by post_id
    comments_by_post = comments_df.groupby('post_id')

    documents = []
    posts_with_comments = 0

    for _, post in posts_df.iterrows():
        post_id = post['post_id']

        # Start with post content
        content_parts = [
            f"Title: {post['title']}",
            f"\nPost: {post['text']}"
        ]

        # Add comments if available
        if post_id in comments_by_post.groups:
            post_comments = comments_by_post.get_group(post_id)

            # Limit number of comments and sort by length (longer = more detailed)
            #post_comments = post_comments.nlargest(max_comments_per_post, 'text', keep='first')

            if len(post_comments) > 0:
                posts_with_comments += 1
                content_parts.append("\n\nComments and Responses:")

                for _, comment in post_comments.iterrows():
                    # Add comment text naturally without numbering
                    content_parts.append(f"\n{comment['text']}")

        # Combine all parts
        full_content = "".join(content_parts)

        # Create document with metadata
        metadata = {
            'post_id': post['post_id'],
            'source': post['source'],
            'date': post['date'],
            'score': post['score'],
            'num_comments': post['num_comments'],
            'url': post['post_link']
        }

        documents.append(Document(page_content=full_content, metadata=metadata))

    print(f"   📊 Created {len(documents)} combined documents")
    print(f"   💬 {posts_with_comments} posts have comments attached")

    return documents


def main():
    """Build and save vector store."""
    print("="*60)
    print("🚀 BUILDING VECTOR STORE")
    print("="*60)

    # Check if CSV files exist
    if not os.path.exists(posts_csv):
        print(f"\n❌ Error: {posts_csv} not found!")
        print("   Please run the data cleaning script first.")
        return

    if not os.path.exists(comments_csv):
        print(f"\n❌ Error: {comments_csv} not found!")
        print("   Please run the data cleaning script first.")
        return

    # Initialize embeddings
    print("\n🔧 Loading embedding model...")
    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={'device': 'cpu'},
        encode_kwargs={'normalize_embeddings': True}
    )
    print("   ✅ Embeddings loaded!")

    # Load and combine data
    documents = combine_posts_with_comments(max_comments_per_post=10)

    # Split documents into chunks
    print("\n🔪 Splitting documents into chunks...")
    chunk_size = 1000  # Larger chunks for combined content
    chunk_overlap = 200
    print(f"   Chunk size: {chunk_size}, Overlap: {chunk_overlap}")

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", " ", ""]
    )

    splits = text_splitter.split_documents(documents)
    print(f"   ✅ Created {len(splits)} chunks")

    # Create vector store
    print("\n🔮 Creating FAISS vector store...")
    db = FAISS.from_documents(documents=splits, embedding=embeddings)
    print("   ✅ Vector store created!")

    # Save vector store
    print(f"\n💾 Saving vector store to {persistent_directory}...")
    os.makedirs(persistent_directory, exist_ok=True)
    db.save_local(persistent_directory)
    print("   ✅ Vector store saved!")

    print("\n" + "="*60)
    print("✅ VECTOR STORE BUILD COMPLETE!")
    print("="*60)
    print(f"\n📊 Summary:")
    print(f"   - Documents: {len(documents)}")
    print(f"   - Chunks: {len(splits)}")
    print(f"   - Location: {persistent_directory}")
    print(f"\n🚀 You can now run rag_query.py to ask questions!")


if __name__ == "__main__":
    main()