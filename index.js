const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config();
const EventSource = require("eventsource");
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
const port = process.env.PORT || 3000;

let dataArray = [];

const token = `${process.env.USERNAME}:${process.env.PASSWORD}`;
const encodedToken = Buffer.from(token).toString("base64");
const headers = {
  headers: {
    Authorization: `Basic ${encodedToken}`,
  },
};

const getData = async (symbol, id) => {
  const events = new EventSource(
    `https://tools.dxfeed.com/penntrading/rest/eventSource.json?events=TimeAndSale&symbols=${symbol}&indent`,
    headers
  );

  events.onmessage = (event) => {
    const parsedData = JSON.parse(event.data);
    if (parsedData.TimeAndSale) {
      const res = parsedData.TimeAndSale[symbol];
      if (res) {
        const r = findSymbol(symbol, id);
        if (!r) {
          console.log(id, symbol, " closed ...");
          events.close();
        } else {
          res.forEach((e) => {
            console.log(id, symbol, e.aggressorSide, e.size);
            if (e.aggressorSide === "BUY") {
              setSymbol(symbol, id, e.size, 0);
            } else if (e.aggressorSide === "SELL") {
              setSymbol(symbol, id, 0, e.size);
            }
          });
        }
      }
    }
  };

  events.onerror = function (err) {
    if (err) {
      if (err.status === 401 || err.status === 403)
        console.log("not authorized");
      else console.log(err);
    }
  };
};

app.post("/post", (req, res) => {
  const symbol = req.body.symbol;
  const id = req.body.id;
  if (!symbol || !id) return res.status(400).send("Bad request");
  let r = { symbol, buyVolume: 0, sellVolume: 0 };
  const s = findSymbol(symbol, id);
  if (!s) {
    addSymbol(symbol, id);
    getData(symbol, id);
  } else {
    r = JSON.parse(JSON.stringify(s));
    resetSymbol(symbol, id);
  }
  console.log("new post ... ", r, s);

  res.json(r);
});

app.post("/post/delete", (req, res) => {
  const symbol = req.body.symbol;
  const id = req.body.id;
  if (!symbol || !id) return res.status(400).send("Bad request");
  const s = findSymbol(symbol, id);
  const r = deleteSymbol(s);
  res.json({ r });
});

app.get("/get/all", (req, res) => {
  res.json(dataArray);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

function findSymbol(symbol, id) {
  const r = dataArray.find((item) => item.symbol === symbol && item.id === id);
  return r;
}

function resetSymbol(symbol, id) {
  const r = dataArray.find((item) => item.symbol === symbol && item.id === id);
  if (!r) return false;
  r.buyVolume = 0;
  r.sellVolume = 0;
  return true;
}

function addSymbol(symbol, id) {
  const r = dataArray.find((item) => item.symbol === symbol && item.id === id);
  if (!r) {
    dataArray.push({
      id: id,
      symbol: symbol,
      buyVolume: 0,
      sellVolume: 0,
    });
  }
}

function setSymbol(symbol, id, buyVolume, sellVolume) {
  const r = dataArray.find((item) => item.symbol === symbol && item.id === id);
  if (!r) return false;
  r.buyVolume += buyVolume;
  r.sellVolume += sellVolume;
  return true;
}

function deleteSymbol(s) {
  const index = dataArray.indexOf(s);
  if (index > -1) {
    dataArray.splice(index, 1);
    return true;
  }
  return false;
}
