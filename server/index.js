const express = require('express');
const cors = require('cors');
const questionsRouter = require('./router');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', questionsRouter);

const PORT = process.env.PORT || 5174;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});

