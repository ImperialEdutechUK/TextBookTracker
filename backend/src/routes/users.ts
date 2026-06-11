import { Router } from 'express';
import { hashPassword } from '../lib/auth';
import { prisma } from '../lib/db';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

// Accepts addresses with international/multi-level domains (e.g.
// learner@yahoo.com.hk): a local part, an "@", a domain, and a top-level
// domain of at least two letters. Deliberately permissive about the provider
// so we don't reject valid worldwide domains, while requiring a real-looking
// TLD instead of just "something with a dot".
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

// Reserved / placeholder domains that are syntactically valid but can never
// receive real mail (RFC 2606 + RFC 6761). These are the classic test stand-ins
// like test@example.com, so we reject them outright.
const RESERVED_EMAIL_DOMAINS = new Set([
  'example.com',
  'example.net',
  'example.org',
  'example.edu',
]);
const RESERVED_EMAIL_TLDS = ['.test', '.example', '.invalid', '.localhost'];

function isValidEmail(email: string): boolean {
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    return false;
  }
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  if (RESERVED_EMAIL_DOMAINS.has(domain)) {
    return false;
  }
  if (RESERVED_EMAIL_TLDS.some((tld) => domain.endsWith(tld))) {
    return false;
  }
  return true;
}

// All user-management endpoints require an ADMIN session.
router.use(requireAdmin);

router.get('/', async (_req, res) => {
  const usersRaw = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
      contactNumber: true,
      address: true,
      createdAt: true,
    },
  });

  const users = usersRaw.map((u) => ({
    id: u.id.toString(),
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    status: u.status,
    contactNumber: u.contactNumber,
    address: u.address,
    createdAt: u.createdAt.toISOString(),
  }));

  return res.json({ users });
});

router.post('/', async (req, res) => {
  const { fullName, email, password, role, contactNumber, address } = req.body ?? {};

  if (!fullName || !email || !role) {
    return res
      .status(400)
      .json({ message: 'Full name, email and role are required.' });
  }

  // Validate the email format for everyone we create here. The pre-existing
  // admin account is not re-validated since it is never created through this
  // endpoint.
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }

  // Learner/Viewer accounts are reference records with no login, so they carry
  // no password. Every other role must set one.
  if (role !== 'VIEWER' && !password) {
    return res.status(400).json({ message: 'Password is required.' });
  }

  // Contact number and address are collected and stored only for Learner/Viewer
  // accounts.
  if (role === 'VIEWER' && !contactNumber) {
    return res
      .status(400)
      .json({ message: 'Contact number is required for Learner/Viewer accounts.' });
  }

  if (role === 'VIEWER' && !address) {
    return res
      .status(400)
      .json({ message: 'Address is required for Learner/Viewer accounts.' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ message: 'Email already exists.' });
  }

  // Viewers/Learners have no login, so their password hash stays null. Every
  // other role gets a bcrypt hash.
  const passwordHash = role === 'VIEWER' ? null : await hashPassword(password);
  await prisma.user.create({
    data: {
      fullName,
      email,
      passwordHash,
      role,
      status: 'ACTIVE',
      contactNumber: role === 'VIEWER' ? contactNumber : null,
      address: role === 'VIEWER' ? address : null,
    },
  });

  return res.status(201).json({ message: 'User created successfully.' });
});

router.put('/:id', async (req, res) => {
  const userId = Number(req.params.id);
  const { status, role, fullName, contactNumber, address } = req.body ?? {};

  const updateData: Record<string, string | null> = {};

  if (status) {
    if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }
    updateData.status = status;
  }

  if (role) {
    if (!['ADMIN', 'CREATOR', 'MANAGER', 'VIEWER'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role value.' });
    }
    updateData.role = role;
  }

  // Editable profile details. Email and role intentionally stay locked from the
  // edit-user flow in the admin UI.
  if (fullName !== undefined) {
    if (typeof fullName !== 'string' || fullName.trim() === '') {
      return res.status(400).json({ message: 'Full name cannot be empty.' });
    }
    updateData.fullName = fullName.trim();
  }

  if (contactNumber !== undefined) {
    const trimmed = typeof contactNumber === 'string' ? contactNumber.trim() : '';
    updateData.contactNumber = trimmed === '' ? null : trimmed;
  }

  if (address !== undefined) {
    const trimmed = typeof address === 'string' ? address.trim() : '';
    updateData.address = trimmed === '' ? null : trimmed;
  }

  if (Object.keys(updateData).length === 0) {
    return res
      .status(400)
      .json({ message: 'No valid update fields were provided.' });
  }

  await prisma.user.update({ where: { id: userId }, data: updateData });
  return res.json({ message: 'User updated successfully.' });
});

// Soft-disable: keeps the record but blocks access by flipping status.
router.patch('/:id/disable', async (req, res) => {
  const userId = Number(req.params.id);
  await prisma.user.update({
    where: { id: userId },
    data: { status: 'INACTIVE' },
  });
  return res.json({ message: 'User disabled successfully.' });
});

// Permanent delete: removes the user record entirely. Fails gracefully if the
// user is still referenced by textbook requests/history (foreign keys).
router.delete('/:id', async (req, res) => {
  const userId = Number(req.params.id);
  try {
    await prisma.user.delete({ where: { id: userId } });
    return res.json({ message: 'User deleted successfully.' });
  } catch (error: any) {
    if (error?.code === 'P2003') {
      return res.status(409).json({
        message:
          'This user is linked to textbook records and cannot be deleted. Disable the account instead.',
      });
    }
    if (error?.code === 'P2025') {
      return res.status(404).json({ message: 'User not found.' });
    }
    throw error;
  }
});

export default router;
