import React, { useEffect, useState } from 'react';
import { Box, H3, Placeholder, Button } from '@adminjs/design-system';
import { NoticeMessage, useNotice } from 'adminjs';
import styled from 'styled-components';

const ApiDocsPage = () => {
  const Frame = styled.iframe`
    width: 100%;
    height: 100%;
  `;

  return (
    <Frame src="/api-docs" />
  );
};

export default ApiDocsPage;
