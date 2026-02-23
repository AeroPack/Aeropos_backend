// Run with: node test-smtp.js
// This tests your SMTP credentials before using them in the app

const nodemailer = require('nodemailer');
require('dotenv').config();

const config = {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '465'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
    },
};

console.log('Testing SMTP with config:');
console.log('  Host:', config.host);
console.log('  Port:', config.port);
console.log('  Secure:', config.secure);
console.log('  User:', config.auth.user);
console.log('  Pass:', config.auth.pass ? '****' + config.auth.pass.slice(-3) : 'NOT SET');
console.log('');

const transporter = nodemailer.createTransport(config);

transporter.verify((error, success) => {
    if (error) {
        console.error('❌ SMTP connection FAILED:');
        console.error('   Code:', error.code);
        console.error('   Message:', error.message);
        console.log('');
        console.log('Possible fixes:');
        console.log('  1. Wrong password — go to Hostinger → Emails → Email Accounts → set a new password');
        console.log('  2. Email account does not exist → create it in Hostinger panel');
        console.log('  3. Try port 587 with EMAIL_SECURE=false instead of 465/true');
    } else {
        console.log('✅ SMTP connection SUCCESSFUL! Credentials are correct.');
        console.log('   Sending a test email...');
        transporter.sendMail({
            from: config.auth.user,
            to: config.auth.user,
            subject: 'SMTP Test',
            text: 'This is a test email from your EZO app.',
        }, (err, info) => {
            if (err) console.error('❌ Send failed:', err.message);
            else console.log('✅ Test email sent! Check inbox of', config.auth.user);
        });
    }
});
