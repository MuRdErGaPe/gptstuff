(function() {
  const HOTKEY = {
    key: '.',
    altKey: true,
    ctrlKey: false,
    shiftKey: false,
    metaKey: false
  };

  const tooltip = document.createElement('div');
  tooltip.className = 'hover-correct-tooltip';
  tooltip.setAttribute('role', 'status');
  tooltip.setAttribute('aria-live', 'polite');
  document.documentElement.appendChild(tooltip);

  const cache = new Map();
  let currentWord = null;
  let pendingCheck = 0;

  function hideTooltip() {
    tooltip.style.display = 'none';
    tooltip.textContent = '';
  }

  function moveTooltip(x, y) {
    tooltip.style.left = `${x + 14}px`;
    tooltip.style.top = `${y + 18}px`;
  }

  function matchesHotkey(event) {
    return (
      event.key === HOTKEY.key &&
      event.altKey === HOTKEY.altKey &&
      event.ctrlKey === HOTKEY.ctrlKey &&
      event.shiftKey === HOTKEY.shiftKey &&
      event.metaKey === HOTKEY.metaKey
    );
  }

  function getCaretFromPoint(x, y) {
    if (document.caretPositionFromPoint) {
      return document.caretPositionFromPoint(x, y);
    }
    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(x, y);
      if (!range) return null;
      return {
        offsetNode: range.startContainer,
        offset: range.startOffset
      };
    }
    return null;
  }

  function isWordChar(char) {
    return /[\p{L}\p{M}\']/u.test(char);
  }

  function extractWord(node, offset) {
    if (!node || node.nodeType !== Node.TEXT_NODE) {
      return null;
    }
    const text = node.textContent;
    if (!text) return null;
    let start = offset;
    let end = offset;

    while (start > 0 && isWordChar(text[start - 1])) start--;
    while (end < text.length && isWordChar(text[end])) end++;

    if (start === end) {
      return null;
    }

    const word = text.slice(start, end);
    if (!/[a-zA-Z]/.test(word)) {
      return null;
    }

    return { word, start, end, textNode: node };
  }

  async function checkSpelling(word) {
    const normalized = word.toLowerCase();
    if (cache.has(normalized)) {
      return cache.get(normalized);
    }

    if (normalized.length < 2) {
      const result = { status: 'short' };
      cache.set(normalized, result);
      return result;
    }

    try {
      const response = await fetch(`https://api.datamuse.com/sug?s=${encodeURIComponent(normalized)}&max=5`, {
        cache: 'force-cache'
      });
      if (!response.ok) {
        throw new Error('Spell service unavailable');
      }
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        const result = { status: 'unknown' };
        cache.set(normalized, result);
        return result;
      }
      const hasExactMatch = data.some(entry => entry.word.toLowerCase() === normalized);
      if (hasExactMatch) {
        const result = { status: 'correct' };
        cache.set(normalized, result);
        return result;
      }
      const suggestion = data[0].word;
      const result = { status: 'incorrect', suggestion };
      cache.set(normalized, result);
      return result;
    } catch (error) {
      const result = { status: 'error', message: error.message };
      cache.set(normalized, result);
      return result;
    }
  }

  function describeSuggestion(word, suggestion) {
    if (!suggestion) return '';
    if (suggestion.toLowerCase() === word.toLowerCase()) {
      return '';
    }
    return suggestion;
  }

  async function handlePointer(event) {
    const caret = getCaretFromPoint(event.clientX, event.clientY);
    if (!caret || !caret.offsetNode) {
      currentWord = null;
      hideTooltip();
      return;
    }

    let textNode = caret.offsetNode;
    let offset = caret.offset;

    if (textNode.nodeType !== Node.TEXT_NODE && caret.offsetNode.childNodes) {
      const child = caret.offsetNode.childNodes[caret.offset];
      if (child && child.nodeType === Node.TEXT_NODE) {
        textNode = child;
        offset = child.textContent ? child.textContent.length : 0;
      }
    }

    const info = extractWord(textNode, offset);
    if (!info) {
      currentWord = null;
      hideTooltip();
      return;
    }

    if (currentWord && currentWord.textNode === info.textNode && currentWord.start === info.start && currentWord.end === info.end) {
      moveTooltip(event.clientX, event.clientY);
      return;
    }

    currentWord = {
      ...info,
      status: 'checking',
      suggestion: null
    };

    const ticket = ++pendingCheck;
    const result = await checkSpelling(info.word);
    if (ticket !== pendingCheck) {
      return;
    }

    if (result.status === 'incorrect' && describeSuggestion(info.word, result.suggestion)) {
      currentWord.status = 'incorrect';
      currentWord.suggestion = result.suggestion;
      tooltip.innerHTML = `<strong>Auto correct available</strong>Press Alt+. to replace with <em>${result.suggestion}</em>`;
      tooltip.style.display = 'block';
      moveTooltip(event.clientX, event.clientY);
    } else if (result.status === 'error') {
      tooltip.innerHTML = `<strong>Spell service unavailable</strong>${result.message}`;
      tooltip.style.display = 'block';
      moveTooltip(event.clientX, event.clientY);
    } else {
      hideTooltip();
      currentWord.status = result.status;
      currentWord.suggestion = null;
    }
  }

  function findEditableAncestor(node) {
    let current = node;
    while (current && current !== document) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        const element = current;
        const tag = element.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') {
          return element;
        }
        if (element.isContentEditable) {
          return element;
        }
      }
      current = current.parentNode;
    }
    return null;
  }

  function replaceInTextNode(info, replacement) {
    const { textNode, start, end } = info;
    const original = textNode.textContent || '';
    const before = original.slice(0, start);
    const after = original.slice(end);
    const nextValue = before + replacement + after;
    textNode.textContent = nextValue;

    const editable = findEditableAncestor(textNode.parentNode || textNode);
    if (editable && (editable.tagName === 'INPUT' || editable.tagName === 'TEXTAREA')) {
      editable.value = nextValue;
      const inputEvent = new Event('input', { bubbles: true });
      editable.dispatchEvent(inputEvent);
    }
  }

  function applySuggestion() {
    if (!currentWord || currentWord.status !== 'incorrect' || !currentWord.suggestion) {
      return;
    }
    replaceInTextNode(currentWord, currentWord.suggestion);
    hideTooltip();
    cache.set(currentWord.word.toLowerCase(), { status: 'correct' });
  }

  document.addEventListener('mousemove', handlePointer, { passive: true });
  document.addEventListener('scroll', hideTooltip, true);

  document.addEventListener('keydown', (event) => {
    if (!matchesHotkey(event)) {
      return;
    }
    if (currentWord && currentWord.status === 'incorrect' && currentWord.suggestion) {
      event.preventDefault();
      applySuggestion();
    }
  }, true);
})();
