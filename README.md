# Intelligent Medical Assistant (RAG-based)

This project is a medical assistant application built using Retrieval-Augmented Generation (RAG). It answers health-related questions based on trusted medical data instead of generating unsupported responses.

The system uses a hybrid architecture. The frontend and database run in Docker for consistency, while the backend and AI models run locally to better utilize hardware resources.

## Features

- RAG-based medical question answering with source grounding  
- Offline Vietnamese to English translation and back  
- Real-time streaming responses  
- Chat session storage with PostgreSQL  
- Toggle between translated and original responses  

## Architecture

Frontend and database run in Docker.  
Backend, vector database, and AI models run locally.

## Tech Stack

Frontend: React, Vite, Tailwind CSS  
Backend: FastAPI, Python, SQLAlchemy  
Database: PostgreSQL  
AI: Ollama (qwen2.5), ChromaDB, BAAI/bge-m3, LangChain  
Translation: Argos Translate (offline)

## Requirements

- Docker and Docker Compose  
- Python 3.10+  
- Ollama with model qwen2.5:1.5b  
- Prebuilt vector database folder (chroma_medical_db)

## Setup

Step 1: Start services with Docker
docker-compose up -d --build

Step 2: Install backend dependencies
pip install -r requirements.txt
python setup_translator.py

Step 3: Run backend
python app.py

The app will be available at:
http://localhost:5173

## Project Structure

frontend/              React UI
chroma_medical_db/     Vector database
app.py                 Backend and RAG pipeline
database.py            Database connection
vector.py              Retrieval logic
setup_translator.py    Translation setup
docker-compose.yml     Service configuration

## Notes

You can adjust model behavior in app.py.  
To change HuggingFace cache location, set HF_HOME in vector.py.

## Author

Your Name or Nickname – 2024
