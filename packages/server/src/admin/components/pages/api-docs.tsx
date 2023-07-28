import React, { useEffect, useState, useRef } from 'react';
import config from '../../../config';
import styled from 'styled-components';

import { ApiClient } from 'adminjs';

const api = new ApiClient();

function getUrlOrigin (url: string) {
  if (url) {
    var parts = url.split('://');

    if (parts.length > 1) {
      return parts[0] + '://' + parts[1].split(/[?\/]/)[0];
    } else {
      return parts[0].split(/[?\/]/)[0];
    }
  }
};

const Frame = styled.iframe`
  width: 100%;
  height: 100%;
`;

const ApiDocsPage = () => {
  const [apiKey, setApiKey] = useState('');

  const frameRef = useRef();
  const isReady = {
    apiKey: false,
    frame: false,
  }
  function trySendMessage(isReadyKey: 'apiKey' | 'frame') {
    isReady[isReadyKey] = true;

    // Check whether all keys in isReady are true
    // @ts-ignore
    const allAreTrue = Object.keys(isReady).every((key) => isReady[key]);
    if (allAreTrue) { sendMessage(); }
  }
  function sendMessage() {
    console.log("Sending message to iframe", { setApiKey: apiKey });
    // @ts-ignore
    if (!frameRef || !frameRef.current || !frameRef.current.contentWindow) {
      console.error("frameRef.current.contentWindow does not exist");
      return
    }
    // @ts-ignore
    frameRef.current.contentWindow.postMessage(
      { setApiKey: apiKey },
      getUrlOrigin(window.location.href),
    );
  }

  useEffect(() => {
    api.getPage({ pageName: 'Public API' }).then((res) => {
      console.log("Received Api Key", res.data)

      setApiKey(res.data.apiKey);
      trySendMessage('apiKey');
    });
  });

  return (
    <Frame
      // @ts-ignore
      ref={frameRef}
      src="/api-docs"
      onLoad={() => {
        setTimeout(() => {
          trySendMessage('frame');
        }, 100);
      }}
    />
  );
}


export default ApiDocsPage;
