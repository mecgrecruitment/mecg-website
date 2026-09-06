/* eslint-disable @typescript-eslint/no-require-imports */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const prototypePath = path.join(__dirname, "speed-dating-pair-grading.html");

async function verify() {
  const server = http.createServer((request, response) => {
    if (request.url !== "/speed-dating-pair-grading.html") {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    fs.createReadStream(prototypePath).pipe(response);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Prototype server did not start");
  const url = `http://127.0.0.1:${address.port}/speed-dating-pair-grading.html`;
  const browser = await chromium.launch({ headless: true });

  try {
    const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    desktop.setDefaultTimeout(5_000);
    const consoleErrors = [];
    desktop.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await desktop.goto(url);
    await desktop.getByRole("searchbox", { name: "Search either applicant's name" }).fill("Jordan");
    const jordanPair = desktop.getByRole("button", { name: /Pair 07.*Jordan Lee.*Maya Patel/ });
    if (await jordanPair.count() !== 1) throw new Error("Searching Jordan must return exactly one pair");
    await jordanPair.click();

    await desktop.locator('article[data-index="0"] input[value="4"]').check();
    await desktop.locator('article[data-index="1"] input[value="5"]').check();
    const review = desktop.getByRole("button", { name: "Review both ratings" });
    if (await review.isEnabled()) throw new Error("A score of 5 must require evidence");

    await desktop.locator("#note-1").fill("Built on the other applicant's answer and explained the tradeoff.");
    if (!(await review.isEnabled())) throw new Error("Valid evidence must make the pair ready");
    await review.click();
    await desktop.getByRole("button", { name: "Submit both ratings" }).click();
    await desktop.getByRole("heading", { name: "Both ratings submitted" }).waitFor();

    await desktop.getByRole("button", { name: "Search the next group" }).click();
    await desktop.getByRole("searchbox", { name: "Search either applicant's name" }).fill("nobody");
    await desktop.getByText("No matching pair", { exact: true }).waitFor();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    mobile.setDefaultTimeout(5_000);
    await mobile.goto(url);
    await mobile.getByRole("searchbox", { name: "Search either applicant's name" }).fill("Priya");
    await mobile.getByRole("button", { name: /Pair 12.*Devon Williams.*Priya Shah/ }).click();
    await mobile.getByRole("heading", { name: "Devon Williams", exact: true }).waitFor();
    await mobile.getByRole("heading", { name: "Priya Shah", exact: true }).waitFor();

    if (consoleErrors.length) throw new Error(`Browser console errors: ${consoleErrors.join(" | ")}`);
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

verify()
  .then(() => console.log("Speed Dating pair-grading prototype passed on desktop and mobile."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
