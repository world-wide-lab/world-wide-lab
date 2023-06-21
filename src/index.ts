import app from './app';

const port = process.env.PORT || 5000;
app.listen(port, () => {
  /* eslint-disable no-console */
  console.log(`Listening on: http://localhost:${port}`);
  /* eslint-enable no-console */
});
