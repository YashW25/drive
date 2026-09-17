import React, { useState, useEffect } from 'react';
import { Monitor, Smartphone, Tablet, Code2, Globe, Rss } from 'lucide-react';
import { TextViewer } from './TextViewer';
import { getFileExtension } from '../../utils/fileTypes';

interface WebPageViewerProps {
  url: string;
  filename: string;
}

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

export const WebPageViewer: React.FC<WebPageViewerProps> = ({ url, filename }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'rss'>('preview');
  const [deviceFrame, setDeviceFrame] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [rssItems, setRssItems] = useState<RssItem[]>([]);
  const ext = getFileExtension(filename);

  useEffect(() => {
    if (ext === 'rss' || ext === 'xml') {
      fetch(url)
        .then((res) => res.text())
        .then((xmlText) => {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
          const items = Array.from(xmlDoc.querySelectorAll('item')).map((item) => ({
            title: item.querySelector('title')?.textContent || 'Untitled',
            link: item.querySelector('link')?.textContent || '#',
            description: item.querySelector('description')?.textContent || '',
            pubDate: item.querySelector('pubDate')?.textContent || '',
          }));
          if (items.length > 0) {
            setRssItems(items);
            setActiveTab('rss');
          }
        })
        .catch(() => {});
    }
  }, [url, ext]);

  const getFrameWidth = () => {
    switch (deviceFrame) {
      case 'mobile':
        return 'w-[375px] h-[667px]';
      case 'tablet':
        return 'w-[768px] h-[700px]';
      default:
        return 'w-full h-full';
    }
  };

  return (
    <div className="w-full h-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      {/* Top Bar Navigation */}
      <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-slate-200">{filename}</span>
          <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-mono font-bold text-[10px] uppercase">
            {ext}
          </span>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
              activeTab === 'preview' ? 'bg-brand-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> Web View
          </button>

          {rssItems.length > 0 && (
            <button
              onClick={() => setActiveTab('rss')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                activeTab === 'rss' ? 'bg-amber-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Rss className="w-3.5 h-3.5" /> RSS Feed ({rssItems.length})
            </button>
          )}

          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
              activeTab === 'code' ? 'bg-brand-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" /> Source Code
          </button>
        </div>

        {/* Responsive Frame Toggle (Only for Preview Tab) */}
        {activeTab === 'preview' && (
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setDeviceFrame('desktop')}
              className={`p-1 rounded ${deviceFrame === 'desktop' ? 'bg-slate-800 text-cyan-400' : 'text-slate-500'}`}
              title="Desktop View"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDeviceFrame('tablet')}
              className={`p-1 rounded ${deviceFrame === 'tablet' ? 'bg-slate-800 text-cyan-400' : 'text-slate-500'}`}
              title="Tablet View"
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDeviceFrame('mobile')}
              className={`p-1 rounded ${deviceFrame === 'mobile' ? 'bg-slate-800 text-cyan-400' : 'text-slate-500'}`}
              title="Mobile View"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-auto bg-slate-950 p-4 flex justify-center items-center">
        {activeTab === 'preview' ? (
          <div
            className={`bg-white rounded-xl shadow-2xl overflow-hidden transition-all duration-300 border border-slate-700 ${getFrameWidth()}`}
          >
            <iframe src={url} title={filename} className="w-full h-full border-none" sandbox="allow-scripts allow-same-origin" />
          </div>
        ) : activeTab === 'rss' ? (
          <div className="w-full max-w-3xl space-y-3 overflow-auto max-h-full">
            {rssItems.map((item, idx) => (
              <div key={idx} className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-left">
                <a
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-brand-400 hover:underline mb-1 block"
                >
                  {item.title}
                </a>
                {item.pubDate && <p className="text-[11px] text-slate-500 mb-2">{item.pubDate}</p>}
                <p className="text-xs text-slate-300 line-clamp-3">{item.description.replace(/<[^>]*>?/gm, '')}</p>
              </div>
            ))}
          </div>
        ) : (
          <TextViewer url={url} filename={filename} />
        )}
      </div>
    </div>
  );
};
