import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import styled from "styled-components";

// Register JS and JSON by default
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);

// Styled <code> block element, this should always be nested within a <pre>
const Code = styled.code`
  font-size: 1rem;
  line-height: 1.25;
  font-family: monospace;

  padding: 1rem !important;
  border-radius: 10px;
`;

// Shorthand to load all required styles for code highlighting.
const CodeHighlightingStyles = () => (
  <>
    <style>{`
      .highlight {
        background-color: rgba(255,255,255, 0.15);
      }
    `}</style>
    <link rel="stylesheet" href="/static/highlight-js/nord.css" />
  </>
);

// This will apply highlighting to all <pre> blocks on the page
function refreshHighlighting() {
  hljs.highlightAll();
}

// Specifically highlight a certain piece of text within highlighted
// code blocks. Requires refreshHighlighting to run first.
function highlightText(searchText: string) {
  const tags = document.getElementsByClassName("hljs-string");
  let foundTag: Element | null = null;
  for (var i = 0; i < tags.length; i++) {
    if (tags[i].textContent == searchText) {
      foundTag = tags[i];
      break;
    }
  }

  if (foundTag) {
    foundTag.classList.add("highlight");
  }
}

export { Code, CodeHighlightingStyles, refreshHighlighting, highlightText };
