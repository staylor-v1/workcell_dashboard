import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { bindApp, view } from './app.js';

function MicrofactoryStudio() {
  const rootRef = useRef(null);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const originalRender = globalThis.__microfactoryRenderApp;
    globalThis.__microfactoryRenderApp = () => forceRender((value) => value + 1);
    bindApp(root);

    return () => {
      globalThis.__microfactoryRenderApp = originalRender;
    };
  }, []);

  return <div ref={rootRef} dangerouslySetInnerHTML={{ __html: view() }} />;
}

createRoot(document.querySelector('#root')).render(<MicrofactoryStudio />);
