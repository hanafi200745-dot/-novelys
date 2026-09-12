CREATE TRIGGER booking_guard_insert BEFORE INSERT ON bookings
WHEN NEW.status IN ('PENDING','CONFIRMED')
BEGIN
SELECT CASE WHEN EXISTS(SELECT 1 FROM bookings b WHERE b.id!=NEW.id AND (b.status='CONFIRMED' OR (b.status='PENDING' AND b.expires_at>unixepoch()*1000)) AND b.starts_at<NEW.ends_at AND b.ends_at>NEW.starts_at) THEN RAISE(ABORT,'BOOKING_CONFLICT') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM availabilities a WHERE a.kind='BLOCKED' AND a.starts_at<NEW.ends_at AND a.ends_at>NEW.starts_at) THEN RAISE(ABORT,'BLOCK_CONFLICT') END;
 SELECT CASE WHEN NEW.status='PENDING' AND NOT EXISTS(SELECT 1 FROM availabilities a WHERE a.kind='AVAILABLE' AND a.starts_at<=NEW.starts_at AND a.ends_at>=NEW.ends_at) THEN RAISE(ABORT,'OUTSIDE_AVAILABILITY') END;
END;
--> statement-breakpoint
CREATE TRIGGER booking_guard_update BEFORE UPDATE OF starts_at,ends_at,status ON bookings
WHEN NEW.status IN ('PENDING','CONFIRMED')
BEGIN
SELECT CASE WHEN EXISTS(SELECT 1 FROM bookings b WHERE b.id!=NEW.id AND (b.status='CONFIRMED' OR (b.status='PENDING' AND b.expires_at>unixepoch()*1000)) AND b.starts_at<NEW.ends_at AND b.ends_at>NEW.starts_at) THEN RAISE(ABORT,'BOOKING_CONFLICT') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM availabilities a WHERE a.kind='BLOCKED' AND a.starts_at<NEW.ends_at AND a.ends_at>NEW.starts_at) THEN RAISE(ABORT,'BLOCK_CONFLICT') END;
 SELECT CASE WHEN NEW.status='PENDING' AND NOT EXISTS(SELECT 1 FROM availabilities a WHERE a.kind='AVAILABLE' AND a.starts_at<=NEW.starts_at AND a.ends_at>=NEW.ends_at) THEN RAISE(ABORT,'OUTSIDE_AVAILABILITY') END;
END;
--> statement-breakpoint
CREATE TRIGGER booking_transitions BEFORE UPDATE OF status ON bookings
WHEN OLD.status!=NEW.status
BEGIN
SELECT CASE WHEN NOT ((OLD.status='PENDING' AND NEW.status IN ('CONFIRMED','DECLINED','CANCELLED')) OR (OLD.status='CONFIRMED' AND NEW.status IN ('COMPLETED','CANCELLED'))) THEN RAISE(ABORT,'INVALID_TRANSITION') END;
SELECT CASE WHEN OLD.status='PENDING' AND NEW.status='CONFIRMED' AND OLD.expires_at<=unixepoch()*1000 THEN RAISE(ABORT,'PENDING_EXPIRED') END;
END;
--> statement-breakpoint
CREATE TRIGGER block_guard BEFORE INSERT ON availabilities
WHEN NEW.kind='BLOCKED'
BEGIN
SELECT CASE WHEN EXISTS(SELECT 1 FROM bookings b WHERE (b.status='CONFIRMED' OR (b.status='PENDING' AND b.expires_at>unixepoch()*1000)) AND b.starts_at<NEW.ends_at AND b.ends_at>NEW.starts_at) THEN RAISE(ABORT,'BOOKING_CONFLICT') END;
END;
--> statement-breakpoint
CREATE TRIGGER block_update_guard BEFORE UPDATE ON availabilities
WHEN NEW.kind='BLOCKED'
BEGIN
SELECT CASE WHEN EXISTS(SELECT 1 FROM bookings b WHERE (b.status='CONFIRMED' OR (b.status='PENDING' AND b.expires_at>unixepoch()*1000)) AND b.starts_at<NEW.ends_at AND b.ends_at>NEW.starts_at) THEN RAISE(ABORT,'BOOKING_CONFLICT') END;
END;
--> statement-breakpoint
CREATE TRIGGER request_transition BEFORE UPDATE OF status ON requests
WHEN OLD.status IN ('ACCEPTED','DECLINED')
BEGIN
SELECT RAISE(ABORT,'REQUEST_PROCESSED');
END;
--> statement-breakpoint
CREATE UNIQUE INDEX request_open_booking ON requests(booking_id) WHERE booking_id IS NOT NULL AND status IN ('PENDING','PROPOSED');
--> statement-breakpoint
CREATE TRIGGER revision_bookings_insert AFTER INSERT ON bookings
BEGIN
INSERT INTO settings(key,value) VALUES('calendarRevision',CAST(unixepoch() AS TEXT)||'-'||hex(randomblob(6))) ON CONFLICT(key) DO UPDATE SET value=excluded.value;
END;
--> statement-breakpoint
CREATE TRIGGER revision_bookings_update AFTER UPDATE ON bookings
BEGIN
INSERT INTO settings(key,value) VALUES('calendarRevision',CAST(unixepoch() AS TEXT)||'-'||hex(randomblob(6))) ON CONFLICT(key) DO UPDATE SET value=excluded.value;
END;
--> statement-breakpoint
CREATE TRIGGER revision_bookings_delete AFTER DELETE ON bookings
BEGIN
INSERT INTO settings(key,value) VALUES('calendarRevision',CAST(unixepoch() AS TEXT)||'-'||hex(randomblob(6))) ON CONFLICT(key) DO UPDATE SET value=excluded.value;
END;
--> statement-breakpoint
CREATE TRIGGER revision_availabilities_insert AFTER INSERT ON availabilities
BEGIN
INSERT INTO settings(key,value) VALUES('calendarRevision',CAST(unixepoch() AS TEXT)||'-'||hex(randomblob(6))) ON CONFLICT(key) DO UPDATE SET value=excluded.value;
END;
--> statement-breakpoint
CREATE TRIGGER revision_availabilities_delete AFTER DELETE ON availabilities
BEGIN
INSERT INTO settings(key,value) VALUES('calendarRevision',CAST(unixepoch() AS TEXT)||'-'||hex(randomblob(6))) ON CONFLICT(key) DO UPDATE SET value=excluded.value;
END;
--> statement-breakpoint
CREATE TRIGGER revision_availabilities_update AFTER UPDATE ON availabilities
BEGIN
INSERT INTO settings(key,value) VALUES('calendarRevision',CAST(unixepoch() AS TEXT)||'-'||hex(randomblob(6))) ON CONFLICT(key) DO UPDATE SET value=excluded.value;
END;
--> statement-breakpoint
CREATE TRIGGER booking_notify_insert AFTER INSERT ON bookings
BEGIN
INSERT INTO notifications(id,user_id,title,body,link,created_at) SELECT lower(hex(randomblob(16))),s.parent_id,CASE WHEN NEW.status='PENDING' THEN 'Demande envoyée — en attente de confirmation' ELSE 'Votre cours est confirmé' END,s.first_name||' · '||NEW.subject,'/espace?cours='||NEW.id,NEW.created_at FROM students s WHERE s.id=NEW.student_id;
INSERT INTO notifications(id,user_id,title,body,link,created_at) SELECT lower(hex(randomblob(16))),u.id,'Nouvelle réservation',(SELECT first_name FROM students WHERE id=NEW.student_id)||' · '||NEW.subject,'/demandes',NEW.created_at FROM users u WHERE u.role='ADMIN' AND NEW.status='PENDING';
END;
--> statement-breakpoint
CREATE TRIGGER booking_notify_update AFTER UPDATE OF status,starts_at ON bookings
WHEN OLD.status!=NEW.status OR OLD.starts_at!=NEW.starts_at
BEGIN
INSERT INTO notifications(id,user_id,title,body,link,created_at) SELECT lower(hex(randomblob(16))),s.parent_id,CASE NEW.status WHEN 'CONFIRMED' THEN 'Votre cours est confirmé' WHEN 'CANCELLED' THEN 'Votre cours est annulé' WHEN 'DECLINED' THEN 'Demande refusée ou expirée' ELSE 'Séance terminée' END,s.first_name||' · '||NEW.subject,'/espace?cours='||NEW.id,NEW.updated_at FROM students s WHERE s.id=NEW.student_id;
UPDATE waiting_list SET status='WAITING' WHERE starts_at<OLD.ends_at AND ends_at>OLD.starts_at AND status='NOTIFIED';
DELETE FROM notifications WHERE dedupe_key IN (SELECT 'wait:'||id FROM waiting_list WHERE starts_at<OLD.ends_at AND ends_at>OLD.starts_at);
END;
--> statement-breakpoint
CREATE TRIGGER notification_email AFTER INSERT ON notifications
BEGIN
INSERT INTO email_outbox(id,user_id,notification_id,recipient,subject,body,status,attempts,available_at,created_at) SELECT lower(hex(randomblob(16))),u.id,NEW.id,u.email,NEW.title,NEW.body,'PENDING',0,NEW.created_at,NEW.created_at FROM users u WHERE u.id=NEW.user_id AND u.demo=0;
END;
