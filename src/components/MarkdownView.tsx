import ReactMarkdown, { type Components } from 'react-markdown';

// 本文・コメント内のリンクはアプリ外へ遷移させない（PWA では外部ブラウザで開く）
const components: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

export function MarkdownView({ children }: { children: string }) {
  return <ReactMarkdown components={components}>{children}</ReactMarkdown>;
}
