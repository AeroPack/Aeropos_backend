import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();
console.log(`[Email Service] Initializing with host: ${process.env.EMAIL_HOST}, port: ${process.env.EMAIL_PORT}, user: ${process.env.EMAIL_USERNAME}`);

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
    },
});

// Verify connection configuration
transporter.verify(function (error, success) {
    if (error) {
        console.error('[Email Service] SMTP Connection Error:', error);
    } else {
        console.log("[Email Service] SMTP Server is ready to take our messages");
    }
});

export const sendVerificationEmail = async (email: string, token: string) => {
    if (!process.env.EMAIL_USERNAME) {
        console.log(`[Email Service] Would send verification email to ${email} with token: ${token}`);
        console.log('[Email Service] Configure EMAIL_USERNAME and EMAIL_PASSWORD to send real emails.');
        return;
    }

    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/verify-email?token=${token}`;

    const mailOptions = {
        from: `"Support Team" <${process.env.EMAIL_USERNAME}>`,
        to: email,
        subject: 'Verify Your Email',
        html: `
            <h3>Verify Your Email Address</h3>
            <p>Please click the link below to verify your email address:</p>
            <a href="${verificationUrl}">Verify Email</a>
            <p>If you did not sign up for this account, please ignore this email.</p>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Verification email sent to ${email}`);
    } catch (error) {
        console.error('Error sending verification email:', error);
        throw new Error('Failed to send verification email');
    }
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
    if (!process.env.EMAIL_USERNAME) {
        console.log(`[Email Service] Would send password reset email to ${email} with token: ${token}`);
        console.log('[Email Service] Configure EMAIL_USERNAME and EMAIL_PASSWORD to send real emails.');
        return;
    }

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/reset-password?token=${token}`;

    const mailOptions = {
        from: `"Support Team" <${process.env.EMAIL_USERNAME}>`,
        to: email,
        subject: 'Password Reset Request',
        html: `
            <h3>Reset Your Password</h3>
            <p>You requested a password reset. Click the link below to set a new password:</p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a>
            <p>This link will expire in <strong>1 hour</strong>.</p>
            <p>If you did not request this, please ignore this email. Your password will remain unchanged.</p>
        `,
    };

    console.log(`[Email Service] Attempting to send reset email to: ${email}`);
    console.log(`[Email Service] Using Reset URL: ${resetUrl}`);

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`[Email Service] Password reset email sent to ${email}`);
        console.log(`[Email Service] Response: ${info.response}`);
    } catch (error) {
        console.error('[Email Service] Error sending password reset email:', error);
        throw new Error('Failed to send password reset email');
    }
};
