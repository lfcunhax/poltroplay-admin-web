const fs = require('fs');
let c1 = fs.readFileSync('src/screens/MoviesAdmin.jsx', 'utf8');
c1 = c1.replace(/setTags\(\[\.\.\.new Set\(\['recent', \.\.\.validGenreNames\]\)\]\);/g, 'const relYear = tmdbData.release_date ? parseInt(tmdbData.release_date.split(\'-\')[0]) : 0; const isRecent = relYear >= new Date().getFullYear() - 1; setTags([...new Set([...(isRecent ? [\'recent\'] : []), ...validGenreNames])]);');
fs.writeFileSync('src/screens/MoviesAdmin.jsx', c1);

let c2 = fs.readFileSync('src/screens/SeriesAdmin.jsx', 'utf8');
c2 = c2.replace(/setTags\(\[\.\.\.new Set\(\['recent', \.\.\.validGenreNames\]\)\]\);/g, 'const relYear = tmdbData.first_air_date ? parseInt(tmdbData.first_air_date.split(\'-\')[0]) : 0; const isRecent = relYear >= new Date().getFullYear() - 1; setTags([...new Set([...(isRecent ? [\'recent\'] : []), ...validGenreNames])]);');
fs.writeFileSync('src/screens/SeriesAdmin.jsx', c2);
console.log('Fixed recent tags!');
