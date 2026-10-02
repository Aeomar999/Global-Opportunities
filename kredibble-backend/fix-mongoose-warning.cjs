const fs = require('fs');
let code = fs.readFileSync('src/routes/auth.js', 'utf8');

code = code.replace(
  "{ new: true, sort: { createdAt: -1 } }",
  "{ returnDocument: 'after', sort: { createdAt: -1 } }"
);

fs.writeFileSync('src/routes/auth.js', code);
console.log('done new: true');
