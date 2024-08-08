import { bundle } from '@adminjs/bundler';

import { componentLoader } from './dist/admin/components/index.js';

(async () => {
  const files = await bundle({
    componentLoader,
    destinationDir: 'static/adminjs', // relative to CWD
    adminJsAssetsDir: '../../node_modules/adminjs/lib/frontend/assets/scripts',
    designSystemDir: '../../node_modules/@adminjs/design-system',
  });
})();
