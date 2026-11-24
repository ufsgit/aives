/**
 * Utility functions for rendering and managing email template content in the frontend
 * without exposing raw HTML tags to users while preserving full formatting (bold, spacing,
 * paragraphs, alignment, and lists).
 */

export function cleanHtmlForDisplay(html: string): string {
  if (!html || typeof html !== 'string') return '';
  let clean = html.trim();

  // 1. Unescape HTML entities if raw tags were HTML-encoded (e.g., &lt;p&gt; -> <p>)
  if (/&lt;(?:p|div|br|strong|b|span|ul|ol|li|h[1-6]|em|i)\b/i.test(clean)) {
    clean = clean
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&');
  }

  // 2. Convert markdown bold (**text** or __text__) to styled strong tags
  clean = clean.replace(/\*\*([\s\S]+?)\*\*/g, '<strong style="font-weight: 700; color: #0f172a;">$1</strong>');
  clean = clean.replace(/__([\s\S]+?)__/g, '<strong style="font-weight: 700; color: #0f172a;">$1</strong>');

  // 3. Convert markdown italic (*text*) to em tags
  clean = clean.replace(/(?<!\*)\*([^*\n\r<]+?)\*(?!\*)/g, '<em style="font-style: italic;">$1</em>');

  // 4. If content has NO HTML block tags, format plain paragraphs & line breaks
  const hasHtmlBlockTags = /<\/?(?:p|div|table|tr|td|th|tbody|thead|ul|ol|li|h[1-6]|br|pre|blockquote)\b/i.test(clean);
  if (!hasHtmlBlockTags) {
    const paragraphs = clean.split(/\r?\n\s*\r?\n/);
    clean = paragraphs
      .map(p => {
        const trimmed = p.trim();
        if (!trimmed) return '';
        return `<p style="margin: 0 0 14px 0; line-height: 1.65; color: #334155;">${trimmed.replace(/\r?\n/g, '<br>')}</p>`;
      })
      .filter(p => !!p)
      .join('');
  }

  // 5. Update legacy blue button colors to green
  clean = clean.replace(/#003366/gi, '#16a34a');

  // 6. Render interest verification button in green for live preview and modal views
  const greenButtonHtml = `
    <div style="margin: 20px 0; font-size: 14px; line-height: 1.8;">
      <p style="margin: 0 0 6px 0;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 18px 0 10px 0;">
          <tr>
            <td align="left" style="border-radius: 6px; background-color: #16a34a;">
              <a href="javascript:void(0)" style="display: inline-block; padding: 14px 28px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 6px; background-color: #16a34a; letter-spacing: 0.5px;">
                YES, I AM INTERESTED – VERIFY MY ENQUIRY
              </a>
            </td>
          </tr>
        </table>
      </p>
      <p style="margin: 0 0 14px 0; font-size: 13px; color: #64748b;">
        <a href="javascript:void(0)" style="color: #64748b; text-decoration: underline;">Not Interested / Didn't submit this enquiry</a>
      </p>
    </div>`;

  clean = clean
    .replace(/<p[^>]*>\s*\[YES,\s*I\s*AM\s*INTERESTED[–\-\s]*VERIFY\s*MY\s*ENQUIRY\]\s*<\/p>/gi, greenButtonHtml)
    .replace(/\[YES,\s*I\s*AM\s*INTERESTED[–\-\s]*VERIFY\s*MY\s*ENQUIRY\]/gi, greenButtonHtml)
    .replace(/\[YES,\s*I\s*WOULD\s*LIKE\s*TO\s*DISCUSS\s*MY\s*PTE\s*TRAINING\s*OPTIONS\]/gi, greenButtonHtml)
    .replace(/\[Response\s*Buttons\]/gi, greenButtonHtml);

  return clean;
}
