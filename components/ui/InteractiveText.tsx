import React, { useMemo, useState } from 'react';

interface Props {
  text: string;
  onWordClick?: (word: string, rect: DOMRect) => void;
  className?: string;
  spokenCharIndex?: number; // For Lens Reader effect
}

const InteractiveText: React.FC<Props> = ({ text, onWordClick, className = '', spokenCharIndex = -1 }) => {
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);

  // 1. Tokenize text into words and non-words (punctuation/spaces)
  const tokenData = useMemo(() => {
    // Regex matches words (alphanumeric + quotes/apostrophes + accented chars)
    // Everything else is considered a delimiter/punctuation token
    const tokens = text.split(/([a-zA-Z0-9'\u00C0-\u00FF]+)/);
    let charCount = 0;
    
    return tokens.map((token, index) => {
        const start = charCount;
        const end = charCount + token.length;
        charCount += token.length;
        // Check if it's a word or just spacing/punctuation
        const isWord = /^[a-zA-Z0-9'\u00C0-\u00FF]+$/.test(token);
        return { token, index, start, end, isWord };
    });
  }, [text]);

  const handleWordClick = (word: string, index: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent parent sentence click
    setActiveWordIndex(index);
    
    const rect = e.currentTarget.getBoundingClientRect();

    // Visual feedback
    setTimeout(() => setActiveWordIndex(null), 500);

    if (onWordClick) {
      onWordClick(word, rect);
    }
  };

  // 2. Calculate Active Token for Lens Mode
  let activeTokenIndex = -1;
  
  if (spokenCharIndex > -1) {
      // Find the token that contains the spokenCharIndex
      for (let i = 0; i < tokenData.length; i++) {
          const t = tokenData[i];
          if (spokenCharIndex >= t.start && spokenCharIndex < t.end) {
              activeTokenIndex = i;
              break;
          }
      }

      // Lookahead Logic:
      // If the boundary fired on a space or punctuation (which can happen with some voices/browsers),
      // or if we are transitioning between words, we want to highlight the *next* word immediately
      // so the user sees where the reading is going.
      if (activeTokenIndex !== -1 && !tokenData[activeTokenIndex].isWord) {
         // Search forward for the next word
         for (let j = activeTokenIndex + 1; j < tokenData.length; j++) {
             if (tokenData[j].isWord) {
                 activeTokenIndex = j;
                 break;
             }
         }
      }

      // Edge case: If we haven't started yet (index 0) but token 0 is empty/space?
      // The logic above handles it via loop.
  }

  const lensMode = spokenCharIndex > -1;

  return (
    <span className={className}>
      {tokenData.map((data, i) => {
        const { token, isWord } = data;
        
        // --- STYLE STATE ---
        // isActive: The word currently being spoken (Flashlight)
        // isPast: Words already spoken (Trail)
        // isFuture: Words coming up (Shadow)
        const isActive = i === activeTokenIndex;
        const isPast = activeTokenIndex > -1 && i < activeTokenIndex;
        
        let colorClass = '';
        
        if (isWord) {
            // Base interactive state
            colorClass = 'transition-all duration-300 rounded cursor-pointer ';
            
            if (lensMode) {
                if (isActive) {
                    // === FLASHLIGHT (Active) ===
                    // Light: Dark text
                    // Dark: White text + Glow + Scale
                    colorClass += 'text-black font-extrabold dark:text-white dark:drop-shadow-[0_0_12px_rgba(255,255,255,0.9)] scale-110 origin-center z-10';
                } else if (isPast) {
                    // === TRAIL (Past) ===
                    // Light: Gray
                    // Dark: Dimmed Gray
                    colorClass += 'text-stone-800 dark:text-stone-400';
                } else {
                    // === SHADOW (Future) ===
                    // Light: Very Light Gray
                    // Dark: Very Dark Gray (barely visible)
                    colorClass += 'text-stone-300 dark:text-stone-800';
                }
            } else {
                // Idle State (No Audio)
                colorClass += 'text-stone-700 dark:text-stone-500 hover:text-indigo-600 dark:hover:text-indigo-300';
            }
        } else {
            // Punctuation / Spaces
            // They follow the trail/future state but don't get the "Active" pop
            if (lensMode) {
                if (isPast) colorClass = 'text-stone-400 dark:text-stone-500 transition-colors duration-500';
                else colorClass = 'text-stone-200 dark:text-stone-800 transition-colors duration-500';
            } else {
                colorClass = 'text-stone-400 dark:text-stone-600';
            }
        }

        if (!isWord) {
            return <span key={i} className={colorClass}>{token}</span>;
        }

        return (
          <span
            key={i}
            onClick={(e) => handleWordClick(token, i, e)}
            className={`interactive-word inline-block ${activeWordIndex === i ? 'highlight-word' : ''} ${colorClass}`}
            style={{ 
                padding: '0 0.05em', 
                margin: '0', 
            }}
          >
            {token}
          </span>
        );
      })}
    </span>
  );
};

export default InteractiveText;