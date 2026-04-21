import os
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
import datetime

# Nếu chạy trong Docker, nó sẽ lấy URL của PostgreSQL. Nếu chạy ngoài, nó dùng SQLite.
DATABASE_URL = "postgresql://chatbot_user:secretpassword@localhost:5432/chatbot_db"

# Khởi tạo kết nối (Nếu là postgres thì không cần check_same_thread)
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Định nghĩa bảng lưu trữ lịch sử
class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), index=True)      # Nhận diện user/phiên chat
    user_question = Column(Text, nullable=False)      # Câu hỏi của user
    ai_response_en = Column(Text)                     # Câu AI trả lời gốc (EN)
    final_response_vi = Column(Text)                  # Câu trả lời đã dịch (VN)
    references_data = Column(Text)                    # Nguồn tài liệu
    created_at = Column(DateTime, default=datetime.datetime.utcnow) # Thời gian

# Tự động tạo bảng nếu chưa có
Base.metadata.create_all(bind=engine)

# Dependency để lấy DB session (Dùng cho FastAPI)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()