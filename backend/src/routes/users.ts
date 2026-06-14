import { Router } from 'express';
import crypto from 'crypto';
import { hashPassword } from '../lib/auth';
import { prisma } from '../lib/db';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();
router.use(requireAdmin);

const userSelect = {
  id: true, fullName: true, email: true, role: true, status: true,
  contactNumber: true, course: true, units: true, address: true, createdAt: true,
};

function serialize(u: any) {
  return {
    id: u.id.toString(),
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    status: u.status,
    contactNumber: u.contactNumber ?? null,
    course: u.course ?? null,
    units: u.units ?? null,
    address: u.address ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

router.get('/', async (req, res) => {
  const role = typeof req.query.role === 'string' ? req.query.role : undefined;
  const usersRaw = await prisma.user.findMany({
    where: role ? { role: role as any } : {},
    orderBy: { createdAt: 'desc' },
    select: userSelect,
  });
  return res.json({ users: usersRaw.map(serialize) });
});

router.post('/', async (req, res) => {
  const { fullName, email, password, role, contactNumber, course, units, address } = req.body ?? {};
  if (!fullName || !email || !role) {
    return res.status(400).json({ message: 'Full name, email and role are required.' });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ message: 'Email already exists.' });
  // Learners don't sign in, so a password is optional. Generate a random one
  // when none is supplied to satisfy the non-null passwordHash column.
  const rawPassword = password || crypto.randomBytes(24).toString('hex');
  const passwordHash = await hashPassword(rawPassword);
  await prisma.user.create({
    data: {
      fullName, email, passwordHash, role, status: 'ACTIVE',
      contactNumber: contactNumber || null,
      course: course || null,
      units: units || null,
      address: address || null,
    },
  });
  return res.status(201).json({ message: 'User created successfully.' });
});

router.put('/:id', async (req, res) => {
  const userId = BigInt(req.params.id);
  const { status, role, fullName, contactNumber, course, units, address } = req.body ?? {};
  const data: Record<string, any> = {};
  if (status) {
    if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }
    data.status = status;
  }
  if (role) {
    if (!['ADMIN', 'CREATOR', 'MANAGER', 'VIEWER'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role value.' });
    }
    data.role = role;
  }
  if (fullName !== undefined) data.fullName = fullName;
  if (contactNumber !== undefined) data.contactNumber = contactNumber || null;
  if (course !== undefined) data.course = course || null;
  if (units !== undefined) data.units = units || null;
  if (address !== undefined) data.address = address || null;
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: 'No valid update fields were provided.' });
  }
  await prisma.user.update({ where: { id: userId }, data });
  return res.json({ message: 'User updated successfully.' });
});

router.delete('/:id', async (req, res) => {
  let userId: bigint;
  try {
    userId = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ message: 'Invalid user id.' });
  }

  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!existing) return res.status(404).json({ message: 'User not found.' });

  // The user can't be hard-deleted while referenced by textbook requests or
  // status history (those FKs are RESTRICT), so deleting would orphan/break
  // that data. Block it with a clear message instead of a DB error.
  const [linkedRequests, linkedHistory] = await Promise.all([
    prisma.textbookRequest.count({ where: { OR: [{ creatorId: userId }, { learnerId: userId }] } }),
    prisma.textbookStatusHistory.count({ where: { changedBy: userId } }),
  ]);
  if (linkedRequests > 0 || linkedHistory > 0) {
    return res.status(409).json({
      message: 'This user has linked textbook requests or history and cannot be deleted. Disable the account instead.',
    });
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
    return res.json({ message: 'User deleted successfully.' });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.status(500).json({ message: 'Could not delete user.' });
  }
});

export default router;
