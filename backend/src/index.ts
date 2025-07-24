import express from "express";
const app = express()
import 'dotenv/config';

app.get('/', (req, res) => {
  res.send('Hello from server!')
})

app.listen(process.env.PORT, () => {
  console.log(`server is listening on port ${process.env.PORT}`)
})
