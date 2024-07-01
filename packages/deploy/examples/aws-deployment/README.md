Steps

1. Install Pulumi
2. Install AWS CLI
3. Install Node JS
4. Copy Folder
5. Install Dependencies


Read Settings from .env / env

```
npx @world-wide-lab/deploy aws
```

or create custom js

```js
const { aws } = require('@world-wide-lab/deploy');

aws({
  env: '.env',
  region: 'us-east-1',
  bucket: 'my-bucket',
  stack: 'my-stack',
  template: 'template.yml',
  parameters: {
    Key: 'Value'
  }
});
```

pulumi up




init

npx @world-wide-lab/deploy init aws