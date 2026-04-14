import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateDescription(content: string, keywords: string[]) {
  const prompt = `
Hãy đóng vai một chuyên gia SEO YouTube và chuyên gia tâm lý giáo dục. 
Nhiệm vụ của bạn là viết một đoạn mô tả video YouTube cho nội dung bài viết dưới đây.

Nội dung bài viết:
"${content}"

Danh sách từ khóa có lượt tìm kiếm cao nhất từ phụ huynh (sát với nội dung nhất):
${keywords.join(", ")}

Yêu cầu QUAN TRỌNG về định dạng và cấu trúc:
Bạn PHẢI tuân thủ chính xác cấu trúc 3 phần dưới đây (sử dụng dấu gạch ngang ---- để phân cách các phần):

[Nội dung mô tả]
- Viết các câu ngắn gọn, cô đọng, súc tích.
- Ngắt các đoạn ra cho rõ ràng, dễ đọc.
- Khéo léo lồng ghép NHIỀU NHẤT CÓ THỂ các từ khóa ở trên vào nội dung một cách tự nhiên.
- Phải "chạm đến nỗi đau" của phụ huynh (những lo lắng, khó khăn, áp lực).

----

[Kêu gọi hành động - CTA]
- Sử dụng các icon (emoji) phù hợp để làm nổi bật và trình bày đẹp mắt.
- Lời kêu gọi mạnh mẽ mời phụ huynh đăng ký/theo dõi kênh để học thêm các mẹo (tips) dạy con hữu ích.

----

[Tags]
- Chuyển các từ khóa thành dạng hashtag (ví dụ: #tuvantamly #daycon).

Lưu ý khác:
- KHÔNG viết lời chào, KHÔNG giới thiệu bản thân.
- KHÔNG sử dụng định dạng bôi đậm (dấu sao **).
- KHÔNG in ra các tiêu đề như "[Nội dung mô tả]", chỉ in ra nội dung và dấu phân cách ----.
- Đi thẳng vào nội dung theo đúng cấu trúc trên.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Không thể tạo mô tả lúc này.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Đã xảy ra lỗi khi kết nối với AI.";
  }
}

export async function getAISuggestions(content: string) {
  const prompt = `
Dựa trên nội dung bài viết dưới đây, hãy gợi ý 10 từ khóa YouTube (không dấu #) mà phụ huynh Việt Nam thường tìm kiếm liên quan đến chủ đề này.

Nội dung:
"${content}"

Trả về danh sách từ khóa, mỗi từ khóa trên một dòng.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text?.split("\n").map(s => s.replace(/^\d+\.\s*/, "").trim()).filter(s => s.length > 0) || [];
  } catch (error) {
    console.error("Gemini Error:", error);
    return [];
  }
}
