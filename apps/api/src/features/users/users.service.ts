import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { eq } from 'drizzle-orm';
import { s3Client } from '../../infra/lib/storage';
import {
  users,
  sessions,
  accounts,
  twoFactor,
  passkeys,
  db
} from '@starter/db';
import { logger } from '../../infra/lib/logger';

const usersServiceLog = logger.child({ module: 'users-service' });

export const UsersService = {
  async softDeleteAccount(userId: string): Promise<{ success: boolean }> {
    // Storage Cleanup (Fails gracefully)
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: `avatars/${userId}.webp`,
      }));
    } catch (storageError) {
      usersServiceLog.warn({ userId, err: storageError }, 'Orphaned avatar or R2 failure');
    }

    // The ACID Database Wipe
    const anonymizedEmail = `deleted_${userId}@qrew.local`;
    try {
      await db.transaction(async (tx) => {
        // Delete foreign keys first
        await tx.delete(sessions).where(eq(sessions.userId, userId));
        await tx.delete(accounts).where(eq(accounts.userId, userId));
        await tx.delete(twoFactor).where(eq(twoFactor.userId, userId));
        await tx.delete(passkeys).where(eq(passkeys.userId, userId));

        // Soft delete the user
        await tx.update(users)
          .set({
            name: "Deleted User",
            email: anonymizedEmail,
            deletedAt: new Date(),
            banned: true,
            banReason: "Account deleted by user"
          })
          .where(eq(users.id, userId));
      });
    } catch (dbError) {
      usersServiceLog.error({ userId, err: dbError }, 'Database soft-delete failed');
      throw new Error("Failed to anonymize database records.");
    }

    return { success: true };
  }
};
