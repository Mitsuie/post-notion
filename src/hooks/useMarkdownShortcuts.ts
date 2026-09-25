import React, { RefObject } from 'react';

interface UseMarkdownShortcutsOptions {
  textareaRef: RefObject<HTMLTextAreaElement>;
  onChange: (value: string) => void;
  onSend: () => void;
}

/**
 * テキストエリアでのMarkdown編集体験を向上させるカスタムフック
 * - Cmd/Ctrl + Enter による即時送信
 * - Tab / Shift + Tab による2スペースインデント・アウトデント（複数行選択対応）
 * - Enter キー押下時のリスト記法・チェックボックス・引用記法の自動継続
 */
export function useMarkdownShortcuts({
  textareaRef,
  onChange,
  onSend,
}: UseMarkdownShortcutsOptions) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 日本語IME等の変換確定時はスルー
    if (e.nativeEvent.isComposing) return;

    // 1. Cmd/Ctrl + Enter で送信
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onSend();
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) return;

    // 2. Tab / Shift + Tab による階層インデント制御（半角スペース2文字）
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = textarea.value;
      const indent = '  '; // Notion/Markdown標準の半角スペース2文字

      const lineStart = currentValue.lastIndexOf('\n', start - 1) + 1;
      const lineEndIndex = currentValue.indexOf('\n', end);
      const actualLineEnd = lineEndIndex === -1 ? currentValue.length : lineEndIndex;

      if (start === end) {
        // 単一カーソル（選択範囲なし）
        if (!e.shiftKey) {
          // Tab: 行頭にインデントを追加して階層を下げる
          const beforeLine = currentValue.substring(0, lineStart);
          const afterLineStart = currentValue.substring(lineStart);
          const newValue = beforeLine + indent + afterLineStart;
          onChange(newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + indent.length;
          }, 0);
        } else {
          // Shift + Tab: 行頭のインデントを最大2文字削除（階層を上げる / アウトデント）
          const currentLine = currentValue.substring(lineStart, actualLineEnd);
          let removedCount = 0;
          if (currentLine.startsWith('  ')) {
            removedCount = 2;
          } else if (currentLine.startsWith(' ') || currentLine.startsWith('\t')) {
            removedCount = 1;
          }
          if (removedCount > 0) {
            const newValue = currentValue.substring(0, lineStart) + currentValue.substring(lineStart + removedCount);
            onChange(newValue);
            setTimeout(() => {
              const newPos = Math.max(lineStart, start - removedCount);
              textarea.selectionStart = textarea.selectionEnd = newPos;
            }, 0);
          }
        }
      } else {
        // 複数行選択時のインデント / アウトデント一括適用
        const selectedLinesText = currentValue.substring(lineStart, actualLineEnd);
        const lines = selectedLinesText.split('\n');

        if (!e.shiftKey) {
          // Tab: 選択範囲の全行頭にインデント追加
          const newLines = lines.map((line) => indent + line);
          const replacement = newLines.join('\n');
          const newValue = currentValue.substring(0, lineStart) + replacement + currentValue.substring(actualLineEnd);
          onChange(newValue);
          setTimeout(() => {
            textarea.selectionStart = start + indent.length;
            textarea.selectionEnd = end + indent.length * lines.length;
          }, 0);
        } else {
          // Shift + Tab: 選択範囲の全行頭から最大2文字削除
          let totalRemoved = 0;
          let firstLineRemoved = 0;
          const newLines = lines.map((line, idx) => {
            let removed = 0;
            if (line.startsWith('  ')) {
              removed = 2;
            } else if (line.startsWith(' ') || line.startsWith('\t')) {
              removed = 1;
            }
            if (idx === 0) firstLineRemoved = removed;
            totalRemoved += removed;
            return line.substring(removed);
          });
          const replacement = newLines.join('\n');
          const newValue = currentValue.substring(0, lineStart) + replacement + currentValue.substring(actualLineEnd);
          onChange(newValue);
          setTimeout(() => {
            textarea.selectionStart = Math.max(lineStart, start - firstLineRemoved);
            textarea.selectionEnd = Math.max(lineStart, end - totalRemoved);
          }, 0);
        }
      }
      return;
    }

    // 3. Enter キー押下時の Markdown 記法自動継続（Auto-continuation）
    if (e.key === 'Enter') {
      const start = textarea.selectionStart;
      const currentValue = textarea.value;

      // カーソルがある現在行を取得
      const lineStart = currentValue.lastIndexOf('\n', start - 1) + 1;
      const lineEndIndex = currentValue.indexOf('\n', start);
      const lineEnd = lineEndIndex === -1 ? currentValue.length : lineEndIndex;
      const currentLine = currentValue.substring(lineStart, lineEnd);

      // Markdown記法のパターンマッチ
      // A. チェックボックス (To-Do): - [ ] または - [x]
      const todoMatch = currentLine.match(/^(\s*[-*+]\s+\[(?: |x|X)\]\s+)(.*)$/);
      // B. 箇条書きリスト: - , * , +
      const bulletMatch = currentLine.match(/^(\s*[-*+]\s+)(.*)$/);
      // C. 番号付きリスト: 1. , 2. 等
      const numberMatch = currentLine.match(/^(\s*)(\d+)(\.\s+)(.*)$/);
      // D. 引用: >
      const quoteMatch = currentLine.match(/^(\s*>+\s*)(.*)$/);

      if (todoMatch) {
        e.preventDefault();
        const prefix = todoMatch[1];
        const contentText = todoMatch[2].trim();

        // 内容が空（プレフィックスのみ）でEnterを押した場合は、リストを終了して通常の空行に
        if (!contentText) {
          const newValue = currentValue.substring(0, lineStart) + currentValue.substring(lineEnd);
          onChange(newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = lineStart;
          }, 0);
          return;
        }

        // 次の行は常に未完了 [ ] で継続
        const indentPart = prefix.match(/^(\s*)/)?.[1] || '';
        const bulletChar = prefix.match(/[-*+]/)?.[0] || '-';
        const nextPrefix = `${indentPart}${bulletChar} [ ] `;
        const insertText = '\n' + nextPrefix;

        const newValue = currentValue.substring(0, start) + insertText + currentValue.substring(start);
        onChange(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
        }, 0);
        return;
      }

      if (bulletMatch) {
        e.preventDefault();
        const prefix = bulletMatch[1];
        const contentText = bulletMatch[2].trim();

        // 空行でのEnterならプレフィックスを消去してリスト終了
        if (!contentText) {
          const newValue = currentValue.substring(0, lineStart) + currentValue.substring(lineEnd);
          onChange(newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = lineStart;
          }, 0);
          return;
        }

        const insertText = '\n' + prefix;
        const newValue = currentValue.substring(0, start) + insertText + currentValue.substring(start);
        onChange(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
        }, 0);
        return;
      }

      if (numberMatch) {
        e.preventDefault();
        const indentPart = numberMatch[1];
        const num = parseInt(numberMatch[2], 10);
        const delimiter = numberMatch[3];
        const contentText = numberMatch[4].trim();

        // 空行でのEnterならプレフィックスを消去してリスト終了
        if (!contentText) {
          const newValue = currentValue.substring(0, lineStart) + currentValue.substring(lineEnd);
          onChange(newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = lineStart;
          }, 0);
          return;
        }

        // 次の番号をインクリメント
        const nextPrefix = `${indentPart}${num + 1}${delimiter}`;
        const insertText = '\n' + nextPrefix;
        const newValue = currentValue.substring(0, start) + insertText + currentValue.substring(start);
        onChange(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
        }, 0);
        return;
      }

      if (quoteMatch) {
        e.preventDefault();
        const prefix = quoteMatch[1];
        const contentText = quoteMatch[2].trim();

        // 空行でのEnterならプレフィックスを消去して引用終了
        if (!contentText) {
          const newValue = currentValue.substring(0, lineStart) + currentValue.substring(lineEnd);
          onChange(newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = lineStart;
          }, 0);
          return;
        }

        const insertText = '\n' + prefix;
        const newValue = currentValue.substring(0, start) + insertText + currentValue.substring(start);
        onChange(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
        }, 0);
        return;
      }
    }
  };

  return { handleKeyDown };
}
