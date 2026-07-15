import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.error("Usage: npm run hash-password -- <password>");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log(hash);
console.log("");
console.log("Add to APP_USERS, e.g.:");
console.log(`APP_USERS='{"youruser":"${hash}"}'`);
