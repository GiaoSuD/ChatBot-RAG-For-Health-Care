import os
import pandas as pd
from langchain_chroma import Chroma
from langchain_core.documents import Document
# Thay đổi import từ Ollama sang HuggingFace
from langchain_community.embeddings import HuggingFaceEmbeddings

# Thư mục lưu trữ database (Đảm bảo đường dẫn này đúng với thư mục bạn đã giải nén)
DB_DIR = "./chroma_medical_db"

def get_retriever():
    # Sử dụng mô hình BAAI/bge-m3 để KHỚP với Vector DB bạn đã tạo trên Kaggle
    # Chúng ta dùng 'cpu' để đảm bảo chạy ổn định trên mọi máy
    embeddings = HuggingFaceEmbeddings(
        model_name="BAAI/bge-m3",
        model_kwargs={'device': 'cpu'}
    )

    if os.path.exists(DB_DIR):
        print("--- Loading Vector DB from disk... ---")
        vector_store = Chroma(
            persist_directory=DB_DIR,
            embedding_function=embeddings,
            collection_name="medical_knowledge"
        )
    else:
        # Trường hợp không tìm thấy DB, báo lỗi để kiểm tra lại file
        print(f"Error: Vector DB not found at {DB_DIR}")
        return None

    # Lấy ra 4 đoạn văn bản liên quan nhất
    return vector_store.as_retriever(search_kwargs={"k": 4})