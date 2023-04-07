const express = require('express');
const router = express.Router();
const passport = require('passport');
// NOTE commented to use passport.js
// NOTE comment passportStrategy in server.js and uncomment below line if auth.js is used
// require('../google_oauth');
const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;

async function getUserSheetsData(accessToken) {
	const oauth2Client = new OAuth2();
	oauth2Client.setCredentials({ access_token: accessToken });
	const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
	// const spreadsheetId = '1z7DWKEzSaDw3KQ4FJY-lQK1LniZcu-erw-p0kGiz_gM';
	const spreadsheetId = '1sPm4cJLCi2L5kUDiui_BPQVXmi1g89aQcq21Tbyxcfw';
	// const range = 'Form Data';
	const range = 'roleMembership';

	try {
		const response = await sheets.spreadsheets.values.get({
			spreadsheetId,
			range,
		});
		const rows = response.data.values;
		return rows;
	} catch (error) {
		console.log("Error accessing user's Google Sheet:", error);
		return null;
	}
}

function isLoggedIn(req, res, next) {
	console.log(req.user);
	req.user ? next() : res.sendStatus(401);
}

router.get('/', (req, res) => {
	res.send('<a href="/auth/google">Authenticate with Google</a>');
});

router.get(
	'/google',
	passport.authenticate('google', {
		scope: [
			'email',
			'profile',
			'https://www.googleapis.com/auth/spreadsheets.readonly',
		],
	}),
	(req, res) => {
		res.json({ message: 'Authentication successful', user: req.user });
	}
);

router.get(
	'/google/callback',
	passport.authenticate('google', {
		successRedirect: `http://localhost:${process.env.CLIENT_PORT}/`,
		// successRedirect: '/auth/protected',
		failureRedirect: '/auth/google/failure',
	})
);

router.get('/protected', isLoggedIn, async (req, res) => {
	const rows = await getUserSheetsData(req.user.accessToken);

	if (rows) {
		const responseData = {
			name: req.user.displayName,
			email: req.user.emails[0].value,
			data: rows,
		};
		if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
			res.json(responseData);
		} else {
			const rowsHtml = rows.map((row) => `<li>${row.join(', ')}</li>`).join('');
			res.send(`
        Name: ${req.user.displayName}<br>
        Email: ${req.user.emails[0].value}<br>
        <ul>${rowsHtml}</ul>
      `);
		}
	} else {
		if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
			res.json({ error: 'Error retrieving Google Sheet data.' });
		} else {
			res.send(`
        Name: ${req.user.displayName}<br>
        Email: ${req.user.emails[0].value}<br>
        <p>Error retrieving Google Sheet data.</p>
      `);
		}
	}
});

router.get('/google/failure', (req, res) => {
	res.send('Failed to authenticate..');
});

router.get('/logout', (req, res) => {
	req.logout(() => {
		req.session.destroy((err) => {
			if (err) {
				console.log('Error destroying session:', err);
				res.status(500).send('Error destroying session');
			} else {
				res.clearCookie('connect.sid'); // Replace 'connect.sid' with the name of your session cookie if it's different
				res.redirect(`http://localhost:${process.env.CLIENT_PORT}/login`);
				// res.send('Goodbye!');
			}
		});
	});
});

module.exports = router;
