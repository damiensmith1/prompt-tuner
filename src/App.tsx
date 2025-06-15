import { useState, useRef} from 'react';
import { Sparkles, Send, Check } from 'lucide-react';

export type ActionItem =
  | { type: 'choice'; label: string; options: string[] }
  | { type: 'multiselect'; label: string; options: string[] }
  | { type: 'input'; label: string; placeholder?: string }
  | { type: 'multientry'; label: string; placeholder?: string };

export default function PromptBuilder() {
  const [prompt, setPrompt] = useState('');
  const [score, setScore] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [enhancements, setEnhancements] = useState<Record<string, any>>({});
  const [finalPrompt, setFinalPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFix, setShowFix] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [errorMsg, setErrorMsg] = useState('');


  const analyze = async () => {
    setLoading(true);
    setScore(null);
    setSuggestions([]);
    setActionItems([]);
    setEnhancements({});
    setFinalPrompt('');
    setShowFix(false);

    const res = await fetch('/api/promptBuilder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'analyze', prompt }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        setErrorMsg("You've reached the limit of 10 prompts per hour. Please try again later.");
      } else {
        const { error } = await res.json().catch(() => ({ error: 'Unexpected error occurred.' }));
        setErrorMsg(error || 'An error occurred while analyzing your prompt.');
      }
      setLoading(false);
      return;
    }

    const data = await res.json();
    setScore(data.score ?? null);
    setSuggestions(Array.isArray(data.critique) ? data.critique : []);
    setActionItems(data.actionItems || []);
    setLoading(false);

    if (data.status === 'ready' && data.improvedPrompt?.trim()) {
      setFinalPrompt(data.improvedPrompt.trim());
    }
  };

  const generate = async () => {
    setLoading(true);
    setFinalPrompt('');
  
    const res = await fetch('/api/promptBuilder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'generate', prompt, enhancements }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        setErrorMsg("You've reached the limit of 10 prompts per hour. Please try again later.");
      } else {
        const { error } = await res.json().catch(() => ({ error: 'Unexpected error occurred.' }));
        setErrorMsg(error || 'An error occurred while generating your prompt.');
      }
      setLoading(false);
      return;
    }
    
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let result = '';
    
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      result += chunk;
      setFinalPrompt(result);
    
      if (scrollRef.current) {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
        });
      }
    }
  
    setLoading(false);
  };
  
  const handleEnhancement = (label: string, value: any) => {
    setEnhancements(prev => ({ ...prev, [label]: value }));
  };

  const reset = () => {
    setPrompt('');
    setScore(null);
    setSuggestions([]);
    setActionItems([]);
    setEnhancements({});
    setFinalPrompt('');
    setShowFix(false);
    setLoading(false);
  };

  const examplePrompts = [
    "Write a marketing email that converts",
    "Create a study plan for learning Python",
    "Help me write an essay for school",
    "Design a workout routine for beginners"
  ];

  const isDefaultState = !prompt && score === null && !finalPrompt;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-amber-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className={`text-center transition-all duration-700 ${isDefaultState ? 'mb-16' : 'mb-8'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-800 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            AI-Powered Prompt Optimization
          </div>
          <h1 className={`font-bold text-gray-900 mb-4 transition-all duration-500 ${
            isDefaultState ? 'text-5xl lg:text-6xl' : 'text-3xl'
          }`}>
            {isDefaultState ? (
              <>
                Perfect Your{' '}
                <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                  AI Prompts
                </span>
              </>
            ) : (
              'Prompt Builder'
            )}
          </h1>
          <p className={`text-gray-600 max-w-2xl mx-auto transition-all duration-500 ${
            isDefaultState ? 'text-xl leading-relaxed' : 'text-base'
          }`}>
            {isDefaultState 
              ? 'Transform your ideas into powerful AI instructions that deliver exceptional results every time'
              : 'Analyze and improve your prompts for better AI responses'
            }
          </p>
        </div>

        <div className="mb-8">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-300"></div>
            <div className="relative bg-white/80 backdrop-blur-sm border border-white/30 rounded-2xl shadow-xl overflow-hidden">
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder={"Enter your draft AI prompt for analysis and improvement..."}
                className={`w-full pt-8 pr-5 pb-5 pl-5 bg-transparent resize-none focus:outline-none text-gray-900 placeholder-gray-500 ${
                    isDefaultState ? 'min-h-[0px]' : 'min-h-[120px]'
                 }`}
                disabled={loading || Boolean(finalPrompt)}
              />
              
              {isDefaultState && (
                <div className="px-6 pb-6">
                  <p className="text-xs text-gray-500 mb-4 mt-4">Quick examples to get started:</p>
                  <div className="flex flex-wrap gap-2" style={{maxWidth: 600}}>
                    {examplePrompts.map((example, index) => (
                      <button
                        key={index}
                        onClick={() => setPrompt(example)}
                        className="px-4 py-1 text-xs bg-gradient-to-r from-orange-100 to-amber-100 hover:from-orange-200 hover:to-amber-200 text-gray-700 rounded-lg border border-orange-200 hover:border-orange-300 transition-all duration-200 hover:scale-105"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className={`absolute ${isDefaultState ? 'bottom-6 right-6' : 'bottom-4 right-4'} flex gap-3`}>
                {finalPrompt && (
                  <button
                    onClick={reset}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={analyze}
                  disabled={!prompt.trim() || loading || Boolean(finalPrompt)}
                  className="px-6 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl hover:scale-105"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Analyzing
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Analyze Prompt
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {score !== null && !finalPrompt && (
          <div className="mb-8 p-6 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Analysis Results</h3>
              <span className="text-sm font-medium text-gray-600">{score}/100</span>
            </div>
            
            <div className="w-full h-2 bg-gray-100 rounded-full mb-6 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  score < 50 ? 'bg-red-500' : score < 75 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${score}%` }}
              />
            </div>

            {suggestions.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Suggestions for improvement:</h4>
                <ul className="space-y-2">
                  {suggestions.map((suggestion, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0" />
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {actionItems.length > 0 && !showFix && (
              <button
                onClick={() => setShowFix(true)}
                className="text-orange-600 hover:text-orange-700 text-sm font-medium transition-colors"
              >
                Improve this prompt →
              </button>
            )}
          </div>
        )}

        {showFix && actionItems.length > 0 && !finalPrompt && (
          <div className="mb-6 p-6 border border-gray-200 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-6">Customize Your Improvements</h3>
            
            <div className="space-y-6">
              {actionItems.map((item, idx) => (
                <div key={idx}>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    {item.label}
                  </label>
                  <ActionInput
                    item={item}
                    value={enhancements[item.label]}
                    setValue={v => handleEnhancement(item.label, v)}
                  />
                </div>
              ))}
            </div>

            <button
              onClick={generate}
              disabled={loading}
              className="mt-6 w-full bg-orange-600 text-white py-3 rounded-lg hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Generating improved prompt...
                </>
              ) : (
                'Generate Improved Prompt'
              )}
            </button>
          </div>
        )}

        {finalPrompt && (
          <div className="p-8 bg-orange/80 backdrop-blur-sm border border-white/30 rounded-2xl shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <Check className="w-4 h-4 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Improved Prompt</h3>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
                {finalPrompt}
              </pre>
              <div ref={scrollRef} className="h-1" />
            </div>
            <div className="mt-6 flex gap-4">
              <button
                onClick={() => navigator.clipboard.writeText(finalPrompt)}
                className="px-3 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 rounded-md transition-all duration-200 font-medium"
              >
                Copy to clipboard
              </button>
              <button
                onClick={reset}
                className="px-3 py-2 text-sm text-orange-600 hover:text-orange-700 hover:bg-orange-50 border border-orange-200 hover:border-orange-300 rounded-md transition-all duration-200 font-medium"
              >
                Start over
              </button>
            </div>
          </div>
        )}
      </div>
      {errorMsg && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white shadow-lg border border-red-200 rounded-lg px-6 py-4 z-50 w-[90%] max-w-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="text-sm text-red-700 font-medium">{errorMsg}</div>
            <button
              onClick={() => setErrorMsg('')}
              className="text-red-400 hover:text-red-600 text-sm font-semibold"
            >
              x
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionInput({ item, value, setValue }: { item: ActionItem; value: any; setValue: (v: any) => void }) {
  if (item.type === 'choice') {
    return (
      <div className="flex gap-2 flex-wrap">
        {item.options.map(opt => (
          <button
            key={opt}
            className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
              value === opt 
                ? 'bg-orange-600 text-white border-orange-600' 
                : 'text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
            onClick={() => setValue(opt)}
            type="button"
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (item.type === 'multiselect') {
    const arr = Array.isArray(value) ? value : [];
    return (
      <div className="flex gap-2 flex-wrap">
        {item.options.map(opt => (
          <button
            key={opt}
            className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
              arr.includes(opt)
                ? 'bg-orange-600 text-white border-orange-600'
                : 'text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
            onClick={() =>
              arr.includes(opt)
                ? setValue(arr.filter((v: string) => v !== opt))
                : setValue([...arr, opt])
            }
            type="button"
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (item.type === 'input') {
    return (
      <input
        type="text"
        value={value || ''}
        onChange={e => setValue(e.target.value)}
        placeholder={item.placeholder}
        className="w-full px-3 py-2 bg-orange-50 border border-orange-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 text-gray-900 placeholder-gray-500"
      />
    );
  }

  if (item.type === 'multientry') {
    const arr = Array.isArray(value) ? value : [];
    const [entry, setEntry] = useState('');
    
    return (
      <div className="space-y-3">
        {arr.length > 0 && (
          <div className="space-y-2">
            {arr.map((entryVal: string, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-md">
                <span className="text-sm text-gray-700">{entryVal}</span>
                <button
                  className="text-red-600 hover:text-red-700 text-sm font-medium transition-colors"
                  onClick={() => setValue(arr.filter((_: any, k: number) => k !== i))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className="flex gap-2">
          <input
            type="text"
            value={entry}
            onChange={e => setEntry(e.target.value)}
            placeholder={item.placeholder}
            className="w-full px-3 py-2 bg-orange-50 border border-orange-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 text-gray-900 placeholder-gray-500"
            onKeyDown={e => {
              if (e.key === 'Enter' && entry.trim()) {
                setValue([...arr, entry.trim()]);
                setEntry('');
              }
            }}
          />
          <button
            className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            disabled={!entry.trim()}
            onClick={() => {
              setValue([...arr, entry.trim()]);
              setEntry('');
            }}
          >
            Add
          </button>
        </div>
      </div>
    );
  }

  return null;
}