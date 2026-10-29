require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hotelBookingDB';
async function sendConfiguredMail(to, subject, text) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !to) return false;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text });
  return true;
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  name: 'haven.sid', secret: process.env.SESSION_SECRET || 'demo-secret-change-before-deploying',
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.static(path.join(__dirname, 'public')));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, default: '' },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  passwordResetTokenHash: { type: String, default: null },
  passwordResetExpires: { type: Date, default: null }
}, { timestamps: true });
const roomSchema = new mongoose.Schema({
  name: String, type: String, description: String, price: Number, pricePerNight: Number, guests: Number, capacity: Number, beds: String, size: String, image: String, amenities: [String], featured: Boolean, available: { type: Boolean, default: true }
}, { timestamps: true });
const bookingSchema = new mongoose.Schema({
  bookingCode: { type: String, unique: true }, customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true }, roomName: String,
  checkIn: Date, checkOut: Date, guests: Number, nights: Number, total: Number,
  status: { type: String, enum: ['Pending', 'Confirmed', 'Checked in', 'Completed', 'Cancelled'], default: 'Pending' },
  paymentStatus: { type: String, enum: ['Unpaid', 'Pending verification', 'Paid', 'Refunded'], default: 'Unpaid' },
  paymentMethod: { type: String, default: 'Pay at hotel' }, paymentReference: { type: String, default: '' }, specialRequests: { type: String, default: '' }
}, { timestamps: true });
const ticketSchema = new mongoose.Schema({
  ticketCode: { type: String, unique: true }, customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: String, message: String, category: { type: String, default: 'Booking question' },
  status: { type: String, enum: ['Open', 'In progress', 'Resolved'], default: 'Open' }, adminReply: { type: String, default: '' }
}, { timestamps: true });
const User = mongoose.model('User', userSchema);
const Room = mongoose.model('Room', roomSchema);
const Booking = mongoose.model('Booking', bookingSchema);
const Ticket = mongoose.model('Ticket', ticketSchema);

const roomSeed = [
  { name: 'Deluxe King Room', type: 'Deluxe', description: 'A calm, spacious retreat with a king bed and city views.', price: 5200, guests: 2, beds: '1 king bed', size: '32 m²', image: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1000&q=85', amenities: ['King bed','Wi-Fi','Breakfast','City view'], featured: true },
  { name: 'Ocean View Suite', type: 'Suite', description: 'An elegant suite with a lounge area and beautiful ocean views.', price: 9800, guests: 3, beds: '1 king bed + sofa', size: '54 m²', image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=85', amenities: ['Ocean view','Lounge','Breakfast','Bathtub'], featured: true },
  { name: 'Garden Twin Room', type: 'Classic', description: 'A bright and comfortable room overlooking the garden.', price: 4100, guests: 2, beds: '2 single beds', size: '28 m²', image: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1000&q=85', amenities: ['Garden view','Wi-Fi','Work desk','Tea & coffee'], featured: false },
  { name: 'Family Residence', type: 'Family', description: 'Room for everyone, with extra space to relax together.', price: 7900, guests: 4, beds: '1 king + 2 single beds', size: '48 m²', image: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1000&q=85', amenities: ['Family size','Wi-Fi','Breakfast','Mini fridge'], featured: true },
  { name: 'Executive Studio', type: 'Executive', description: 'A refined workspace and restful room for business travel.', price: 6500, guests: 2, beds: '1 queen bed', size: '36 m²', image: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1000&q=85', amenities: ['Work desk','Fast Wi-Fi','Coffee machine','Late checkout'], featured: false },
  { name: 'Haven Penthouse', type: 'Premium', description: 'A signature stay with premium finishes and a private terrace.', price: 14500, guests: 4, beds: '2 king beds', size: '78 m²', image: 'https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=1000&q=85', amenities: ['Private terrace','Lounge','Breakfast','Premium bath'], featured: true }
];

function publicUser(user) { return { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role }; }
function requireAuth(req, res, next) { if (!req.session.user) return res.status(401).json({ message: 'Please log in to continue.' }); next(); }
function requireAdmin(req, res, next) { if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required.' }); next(); }
function nightsBetween(a, b) { return Math.ceil((new Date(b) - new Date(a)) / 86400000); }
function overlaps(aStart, aEnd, bStart, bEnd) { return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart); }

app.get('/api/me', (req, res) => res.json({ user: req.session.user || null }));
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required.' });
    if (String(password).length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    const normalizedEmail = String(email).trim().toLowerCase();
    if (await User.findOne({ email: normalizedEmail })) return res.status(409).json({ message: 'An account with this email already exists.' });
    const user = await User.create({ name: String(name).trim(), email: normalizedEmail, phone: phone || '', passwordHash: await bcrypt.hash(password, 12), role: 'customer' });
    req.session.user = publicUser(user); res.status(201).json({ user: req.session.user, message: 'Account created successfully.' });
  } catch (e) { res.status(500).json({ message: 'Could not create account.' }); }
});
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, portal } = req.body;
    const user = await User.findOne({ email: String(email || '').trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' });
    if (portal === 'admin' && user.role !== 'admin') return res.status(403).json({ message: 'This account is not an administrator account.' });
    if (portal === 'customer' && user.role !== 'customer') return res.status(403).json({ message: 'Please use the admin login portal.' });
    req.session.user = publicUser(user); res.json({ user: req.session.user, message: 'Logged in successfully.' });
  } catch (e) { res.status(500).json({ message: 'Could not log in.' }); }
});
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = await User.findOne({ email, role: 'customer' });
    // Always return the same public message so account existence is not revealed.
    const message = 'If a customer account exists for that email, a reset link has been generated.';
    if (!user) return res.json({ message });
    const rawToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    const baseUrl = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
    const resetUrl = `${baseUrl}/?resetToken=${rawToken}`;
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || 'false') === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER, to: user.email,
        subject: 'Reset your Haven House password',
        text: `Hello ${user.name},\n\nUse this link to reset your Haven House password within 30 minutes:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`
      });
    } else {
      console.log(`\n[DEMO PASSWORD RESET] For ${user.email}, open this link within 30 minutes:\n${resetUrl}\nConfigure SMTP settings in .env to send real email.\n`);
    }
    res.json({ message });
  } catch (err) { console.error('Forgot password error:', err.message); res.status(500).json({ message: 'Could not create a reset link. Please try again.' }); }
});
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || String(password).length < 8) return res.status(400).json({ message: 'Use a valid reset link and a password with at least 8 characters.' });
    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const user = await User.findOne({ passwordResetTokenHash: tokenHash, passwordResetExpires: { $gt: new Date() }, role: 'customer' });
    if (!user) return res.status(400).json({ message: 'This reset link is invalid or expired. Please request a new one.' });
    user.passwordHash = await bcrypt.hash(String(password), 12);
    user.passwordResetTokenHash = null; user.passwordResetExpires = null;
    await user.save();
    res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (err) { res.status(500).json({ message: 'Could not reset password. Please try again.' }); }
});
app.post('/api/auth/logout', (req, res) => req.session.destroy(() => res.json({ message: 'Logged out.' })));

app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await Room.find().lean();
    const { checkIn, checkOut, guests } = req.query;
    // Support both the original schema (price/guests) and the newer uploaded
    // database fields (pricePerNight/capacity), so existing room data remains usable.
    let result = rooms.map(r => ({
      ...r,
      price: Number(r.price ?? r.pricePerNight ?? 0),
      guests: Number(r.guests ?? r.capacity ?? 2),
      size: r.size || (r.type ? `${r.type} room` : 'Comfortable room'),
      featured: Boolean(r.featured ?? ['Deluxe King Room', 'Executive Suite', 'Family Comfort Room'].includes(r.name))
    }));
    if (guests) result = result.filter(r => r.guests >= Number(guests));
    if (checkIn && checkOut && new Date(checkOut) > new Date(checkIn)) {
      const bookings = await Booking.find({ status: { $nin: ['Cancelled', 'Completed'] }, checkIn: { $lt: new Date(checkOut) }, checkOut: { $gt: new Date(checkIn) } }).select('room').lean();
      const occupied = new Set(bookings.map(b => String(b.room)));
      result = result.map(r => ({ ...r, available: !occupied.has(String(r._id)) }));
    } else result = result.map(r => ({ ...r, available: r.available !== false }));
    res.json({ rooms: result });
  } catch (e) { res.status(500).json({ message: 'Could not load rooms.' }); }
});
app.post('/api/bookings', requireAuth, async (req, res) => {
  try {
    const { roomId, checkIn, checkOut, guests, paymentMethod, specialRequests, paymentReference } = req.body;
    const start = new Date(checkIn), end = new Date(checkOut), today = new Date(); today.setHours(0,0,0,0);
    if (!roomId || !checkIn || !checkOut || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start < today || end <= start) return res.status(400).json({ message: 'Choose valid future check-in and check-out dates.' });
    const room = await Room.findById(roomId); if (!room) return res.status(404).json({ message: 'Room not found.' });
    if (!Number.isInteger(Number(guests)) || Number(guests) < 1 || Number(guests) > Number(room.guests ?? room.capacity ?? 2)) return res.status(400).json({ message: `This room accommodates up to ${room.guests ?? room.capacity ?? 2} guests.` });
    const conflict = await Booking.findOne({ room: room._id, status: { $nin: ['Cancelled', 'Completed'] }, checkIn: { $lt: end }, checkOut: { $gt: start } });
    if (conflict) return res.status(409).json({ message: 'This room is not available for those dates. Please choose another room or dates.' });
    const nights = nightsBetween(start, end); const method = ['Pay at hotel', 'UPI / bank transfer'].includes(paymentMethod) ? paymentMethod : 'Pay at hotel';
    const booking = await Booking.create({ bookingCode: 'HH-' + Date.now().toString().slice(-7), customer: req.session.user.id, room: room._id, roomName: room.name, checkIn: start, checkOut: end, guests: Number(guests), nights, total: nights * Number(room.price ?? room.pricePerNight ?? 0), paymentMethod: method, paymentReference: method === 'UPI / bank transfer' ? String(paymentReference || '').trim() : '', specialRequests: String(specialRequests || '').trim(), status: 'Pending', paymentStatus: method === 'UPI / bank transfer' ? 'Pending verification' : 'Unpaid' });
    res.status(201).json({ booking, message: 'Booking request submitted. Check your dashboard for updates.' });
  } catch (e) { res.status(500).json({ message: 'Could not create booking.' }); }
});
app.get('/api/bookings/mine', requireAuth, async (req, res) => {
  const bookings = await Booking.find({ customer: req.session.user.id }).sort({ createdAt: -1 }).lean(); res.json({ bookings });
});
app.post('/api/bookings/:id/cancel', requireAuth, async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.id, customer: req.session.user.id });
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });
  if (['Checked in', 'Completed', 'Cancelled'].includes(booking.status)) return res.status(400).json({ message: 'This booking can no longer be cancelled online.' });
  booking.status = 'Cancelled'; if (booking.paymentStatus === 'Paid' || booking.paymentStatus === 'Pending verification') booking.paymentStatus = 'Refunded'; await booking.save(); res.json({ message: 'Booking cancelled.', booking });
});
app.post('/api/tickets', requireAuth, async (req, res) => {
  const { subject, message, category } = req.body;
  if (!subject || !message) return res.status(400).json({ message: 'Subject and message are required.' });
  const ticket = await Ticket.create({ ticketCode: 'CARE-' + Date.now().toString().slice(-7), customer: req.session.user.id, subject: String(subject).trim(), message: String(message).trim(), category: category || 'Booking question' });
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try { await sendConfiguredMail(adminEmail, `[Haven House] New guest-care message: ${ticket.subject}`, `A guest sent a new customer-care message.\n\nTicket: ${ticket.ticketCode}\nCategory: ${ticket.category}\nSubject: ${ticket.subject}\nMessage: ${ticket.message}\n\nSign in to the Haven House admin account and open Guest care to reply.`); }
    catch (mailError) { console.error('Admin support notification email failed:', mailError.message); }
  } else { console.log(`[GUEST CARE] New ticket ${ticket.ticketCode}: ${ticket.subject}. Sign in as admin and open Guest care.`); }
  res.status(201).json({ ticket, message: 'Your support request has been sent.' });
});
app.get('/api/tickets/mine', requireAuth, async (req, res) => { res.json({ tickets: await Ticket.find({ customer: req.session.user.id }).sort({ createdAt: -1 }).lean() }); });

app.get('/api/admin/overview', requireAdmin, async (req, res) => {
  const [totalBookings, pendingBookings, confirmedBookings, revenueAgg, pendingPayments, openTickets, customers, rooms] = await Promise.all([
    Booking.countDocuments(), Booking.countDocuments({ status: 'Pending' }), Booking.countDocuments({ status: { $in: ['Confirmed','Checked in','Completed'] } }),
    Booking.aggregate([{ $match: { paymentStatus: 'Paid' } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    Booking.countDocuments({ paymentStatus: 'Pending verification' }), Ticket.countDocuments({ status: { $ne: 'Resolved' } }), User.countDocuments({ role: 'customer' }), Room.countDocuments()
  ]);
  res.json({ stats: { totalBookings, pendingBookings, confirmedBookings, revenue: revenueAgg[0]?.total || 0, pendingPayments, openTickets, customers, rooms } });
});
app.get('/api/admin/bookings', requireAdmin, async (req, res) => {
  const bookings = await Booking.find().populate('customer', 'name email phone').sort({ createdAt: -1 }).lean(); res.json({ bookings });
});
app.patch('/api/admin/bookings/:id', requireAdmin, async (req, res) => {
  const allowedStatus = ['Pending','Confirmed','Checked in','Completed','Cancelled'];
  const allowedPayment = ['Unpaid','Pending verification','Paid','Refunded'];
  const update = {};
  if (req.body.status && allowedStatus.includes(req.body.status)) update.status = req.body.status;
  if (req.body.paymentStatus && allowedPayment.includes(req.body.paymentStatus)) update.paymentStatus = req.body.paymentStatus;
  if (!Object.keys(update).length) return res.status(400).json({ message: 'No valid updates supplied.' });
  const booking = await Booking.findByIdAndUpdate(req.params.id, update, { new: true }); if (!booking) return res.status(404).json({ message: 'Booking not found.' }); res.json({ booking, message: 'Booking updated.' });
});
app.get('/api/admin/tickets', requireAdmin, async (req, res) => { res.json({ tickets: await Ticket.find().populate('customer', 'name email phone').sort({ createdAt: -1 }).lean() }); });
app.patch('/api/admin/tickets/:id', requireAdmin, async (req, res) => {
  const update = {}; if (['Open','In progress','Resolved'].includes(req.body.status)) update.status = req.body.status; if (typeof req.body.adminReply === 'string') update.adminReply = req.body.adminReply.trim();
  const previous = await Ticket.findById(req.params.id);
  if (!previous) return res.status(404).json({ message: 'Support ticket not found.' });
  const ticket = await Ticket.findByIdAndUpdate(req.params.id, update, { new: true }).populate('customer', 'name email');
  if (typeof req.body.adminReply === 'string' && ticket.adminReply && ticket.adminReply !== previous.adminReply && ticket.customer?.email) {
    try { await sendConfiguredMail(ticket.customer.email, `Haven House guest-care reply: ${ticket.subject}`, `Hello ${ticket.customer.name},\n\nOur guest-care team replied to your request (${ticket.ticketCode}).\n\nSubject: ${ticket.subject}\nReply: ${ticket.adminReply}\n\nYou can sign in to Haven House to view your support thread.`); }
    catch (mailError) { console.error('Guest reply email failed:', mailError.message); }
  }
  res.json({ ticket, message: 'Support ticket updated.' });
});
app.get('/api/admin/customers', requireAdmin, async (req, res) => { const customers = await User.find({ role: 'customer' }).select('name email phone createdAt').sort({ createdAt: -1 }).lean(); res.json({ customers }); });

async function seed() {
  if (await Room.countDocuments() === 0) await Room.insertMany(roomSeed);
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@havenhouse.com').toLowerCase();
  if (!(await User.findOne({ email: adminEmail }))) {
    const password = process.env.ADMIN_PASSWORD || 'Admin@12345';
    await User.create({ name: 'Haven House Admin', email: adminEmail, phone: '', passwordHash: await bcrypt.hash(password, 12), role: 'admin' });
    console.log(`Demo admin created: ${adminEmail} / ${password}`);
  }
}
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const builtIndex = path.join(__dirname, 'dist', 'index.html');
  const fs = require('fs');
  if (fs.existsSync(builtIndex)) return res.sendFile(builtIndex);
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function start() {
  try { await mongoose.connect(MONGODB_URI); await seed(); app.listen(PORT, () => console.log(`Haven House is running at http://localhost:${PORT}`)); }
  catch (err) { console.error('MongoDB connection failed. Make sure MongoDB Community Server is installed and running.', err.message); process.exit(1); }
}
start();
