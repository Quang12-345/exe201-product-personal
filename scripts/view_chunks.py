import asyncio
import sys
# pyrefly: ignore [missing-import]
from sqlalchemy import select
from src.db.session import AsyncSessionLocal
from src.db.models import Document, DocumentChunk

async def view_chunks():
    async with AsyncSessionLocal() as session:
        # Fetch all documents
        result = await session.execute(select(Document).order_by(Document.title))
        docs = result.scalars().all()
        
        if not docs:
            print("Không tìm thấy tài liệu nào trong Database. Hãy chạy ingestion trước.")
            return
            
        # Check if user passed a document index or title search keyword
        keyword = sys.argv[1] if len(sys.argv) > 1 else None
        
        selected_doc = None
        if keyword:
            # Try to match by index or substring
            try:
                idx = int(keyword) - 1
                if 0 <= idx < len(docs):
                    selected_doc = docs[idx]
            except ValueError:
                # Match by substring
                for doc in docs:
                    if keyword.lower() in doc.title.lower() or keyword.lower() in doc.file_name.lower():
                        selected_doc = doc
                        break
                        
            if not selected_doc:
                print(f"Không tìm thấy tài liệu nào khớp với từ khóa: '{keyword}'")
                return
        
        if not selected_doc:
            print("DANH SÁCH TÀI LIỆU TRONG DATABASE:")
            for idx, doc in enumerate(docs, start=1):
                print(f"{idx}. {doc.title} (Trang: {doc.total_pages}, Số chunk: {doc.total_chunks})")
            print("\nHướng dẫn sử dụng:")
            print("  - Xem danh sách chunk của tài liệu số 1:  python scripts/view_chunks.py 1")
            print("  - Tìm theo tên tài liệu:                   python scripts/view_chunks.py logical")
            print("\nHiển thị demo 3 chunks đầu tiên của tài liệu đầu tiên:")
            selected_doc = docs[0]
            
        print(f"\n================================================================================")
        print(f"TÀI LIỆU: {selected_doc.title}")
        print(f"File: {selected_doc.file_name} | Tổng số chunk: {selected_doc.total_chunks}")
        print(f"================================================================================")
        
        # Query chunks
        query = (
            select(DocumentChunk)
            .where(DocumentChunk.document_id == selected_doc.id)
            .order_by(DocumentChunk.chunk_index)
        )
        # If showing demo, limit to 3 chunks
        if not keyword:
            query = query.limit(3)
            
        chunks_res = await session.execute(query)
        chunks = chunks_res.scalars().all()
        
        for chunk in chunks:
            print(f"\n[Chunk {chunk.chunk_index + 1}/{selected_doc.total_chunks}]")
            print(f"Trang: {chunk.page_number or 'N/A'} | Độ dài: {chunk.token_count} tokens")
            section = chunk.metadata_json.get("section_title")
            if section:
                print(f"Chương/Mục: \"{section}\"")
            print("-" * 50)
            print(chunk.content)
            print("=" * 80)
            
        if not keyword and selected_doc.total_chunks > 3:
            print(f"\n... Còn lại {selected_doc.total_chunks - 3} chunks nữa. Hãy chạy `python scripts/view_chunks.py {selected_doc.title}` để xem toàn bộ.")

if __name__ == "__main__":
    asyncio.run(view_chunks())
