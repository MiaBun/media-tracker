const express = require('express');
const path = require('path');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.redirect('/manga'));

app.use('/manga', require('./routes/manga'));
app.use('/screen', require('./routes/screen'));
app.use('/games', require('./routes/games'));

app.use((req, res) => res.status(404).render('404', { title: 'Not found' }));

app.listen(PORT, () => console.log(`Trackr running at http://localhost:${PORT}`));
