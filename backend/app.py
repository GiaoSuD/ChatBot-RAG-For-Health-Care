import time
import argostranslate.translate as at
from sqlalchemy.orm import Session
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_ollama import OllamaLLM
from langchain_core.prompts import ChatPromptTemplate
from vector import get_retriever 
from fastapi import Depends
from database import get_db, ChatHistory
import json

# ==========================================
# 1. CẤU HÌNH AI VÀ RAG
# ==========================================
MODEL_ID = "qwen2.5:1.5b" 
model = OllamaLLM(
    model=MODEL_ID,
    temperature=0.2,
    repeat_penalty=1.3,
    num_predict=1024,
)

template = """
You are a professional Medical Assistant. 
Task: Answer the user's question based ONLY on the provided medical context.
Answer clearly and concisely in ENGLISH.

IMPORTANT RULES:
1. Use bullet points (-) to list complications, symptoms, or instructions.
2. Extract the key details directly. DO NOT repeat the same information.
3. Do NOT use the character "*".
4. Stop generating once the question is fully answered.

CONTEXT: 
{context}

USER QUESTION: 
{question}

ANSWER IN ENGLISH:
"""
prompt = ChatPromptTemplate.from_template(template)
chain = prompt | model
retriever = get_retriever() 

# ==========================================
# 2. CẤU HÌNH API SERVER (FastAPI)
# ==========================================
app = FastAPI()

# Cấp quyền cho giao diện Web (HTML) được phép gọi API này
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Định nghĩa dữ liệu Web gửi lên
class ChatRequest(BaseModel):
    message: str
    language: str # "en" hoặc "vi"
    session_id: str
# ==========================================
# 3. API XỬ LÝ CHAT (STREAMING)
# ==========================================
@app.post("/chat")
async def chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)): # Thêm db ở đây
    def generate():
        start_time = time.time()
        en_question = ""
        full_en_response = ""
        vi_response = ""
        ref_text = ""

        try:
            # 1. Dịch câu hỏi
            en_question = at.translate(request.message, "vi", "en")
            
            # 2. Truy xuất tài liệu
            docs = retriever.invoke(en_question)
            context_text = "\n".join([doc.page_content[:600] for doc in docs])
            references = set()
            for doc in docs:
                source = doc.metadata.get('source', 'Unknown')
                focus = doc.metadata.get('focus_area', 'General')
                references.add(f"- Nguồn: {source} | Chuyên khoa: {focus}")
            ref_text = "\n".join(references)

            # 3. Stream tiếng Anh
            for chunk in chain.stream({"context": context_text, "question": en_question}):
                full_en_response += chunk
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            
            # 4. Dịch sang tiếng Việt
            yield f"data: {json.dumps({'status': 'Đang dịch sang Tiếng Việt...'})}\n\n"
            vi_response = at.translate(full_en_response, "en", "vi")
            yield f"data: {json.dumps({'final_vi': vi_response, 'references': ref_text})}\n\n"

            # === BƯỚC QUAN TRỌNG: LƯU VÀO DATABASE ===
            new_chat = ChatHistory(
                session_id=request.session_id, # Frontend cần gửi cái này lên
                user_question=request.message,
                ai_response_en=full_en_response,
                final_response_vi=vi_response,
                references_data=ref_text
            )
            db.add(new_chat)
            db.commit()
            # =========================================

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

        yield f"data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
@app.get("/history/{session_id}")
def get_chat_history(session_id: str, db: Session = Depends(get_db)):
    # Tìm tất cả tin nhắn của session_id này, sắp xếp theo thời gian cũ -> mới
    history = db.query(ChatHistory).filter(ChatHistory.session_id == session_id).order_by(ChatHistory.created_at.asc()).all()
    
    # Định dạng lại dữ liệu để gửi về cho React
    result = []
    for chat in history:
        result.append({
            "id": str(chat.id) + "u",
            "sender": "user",
            "text": chat.user_question
        })
        result.append({
            "id": str(chat.id) + "b",
            "sender": "bot",
            "enContent": chat.ai_response_en,
            "viContent": chat.final_response_vi,
            "references": chat.references_data,
            "activeLang": "vi" 
        })
    return result
@app.get("/all-sessions")
def get_all_sessions(db: Session = Depends(get_db)):
    # Lấy danh sách các session_id duy nhất và câu hỏi đầu tiên của mỗi session để làm tiêu đề
    from sqlalchemy import func
    
    # Query lấy session_id và câu hỏi đầu tiên (theo thời gian)
    subquery = db.query(
        ChatHistory.session_id,
        ChatHistory.user_question,
        func.min(ChatHistory.created_at).over(partition_by=ChatHistory.session_id).label('min_time')
    ).subquery()
    
    distinct_sessions = db.query(subquery.c.session_id, subquery.c.user_question).distinct().all()
    
    return [{"id": s[0], "title": s[1][:30] + "..." if len(s[1]) > 30 else s[1]} for s in distinct_sessions]
@app.delete("/delete-session/{session_id}")
def delete_session(session_id: str, db: Session = Depends(get_db)):
    # Tìm và xóa toàn bộ các dòng có cùng session_id
    db.query(ChatHistory).filter(ChatHistory.session_id == session_id).delete()
    db.commit()
    return {"status": "success", "message": f"Hội thoại {session_id} đã được xóa sạch."}
if __name__ == "__main__":
    import uvicorn
    print("\n🚀 Khởi động Server... Hãy mở file index.html trên trình duyệt.")
    uvicorn.run(app, host="0.0.0.0", port=8000)
