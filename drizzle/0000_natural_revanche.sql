CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`entity_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `auth_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `availabilities` (
	`id` text PRIMARY KEY NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`kind` text DEFAULT 'AVAILABLE' NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`demo` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "availability_interval" CHECK("availabilities"."ends_at">"availabilities"."starts_at"),
	CONSTRAINT "availability_kind" CHECK("availabilities"."kind" in ('AVAILABLE','BLOCKED'))
);
--> statement-breakpoint
CREATE INDEX `idx_availability_time` ON `availabilities` (`starts_at`,`ends_at`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`series_id` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`subject` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`expires_at` integer,
	`work_on` text DEFAULT '' NOT NULL,
	`preparation` text DEFAULT '' NOT NULL,
	`location` text DEFAULT 'Médiathèque' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`series_id`) REFERENCES `recurring_bookings`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "booking_interval" CHECK("bookings"."ends_at">"bookings"."starts_at"),
	CONSTRAINT "booking_status" CHECK("bookings"."status" in ('PENDING','CONFIRMED','COMPLETED','CANCELLED','DECLINED')),
	CONSTRAINT "pending_expiration" CHECK("bookings"."status"!='PENDING' or "bookings"."expires_at" is not null)
);
--> statement-breakpoint
CREATE INDEX `idx_bookings_student_time` ON `bookings` (`student_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `idx_bookings_status_time` ON `bookings` (`status`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`booking_id` text,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_object_key_unique` ON `documents` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_documents_student` ON `documents` (`student_id`);--> statement-breakpoint
CREATE TABLE `email_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`notification_id` text,
	`recipient` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`available_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `lesson_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`student_id` text NOT NULL,
	`concepts` text NOT NULL,
	`difficulties` text DEFAULT '' NOT NULL,
	`progress` text DEFAULT '' NOT NULL,
	`homework` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lesson_reports_booking_id_unique` ON `lesson_reports` (`booking_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`link` text DEFAULT '/espace' NOT NULL,
	`read_at` integer,
	`created_at` integer NOT NULL,
	`dedupe_key` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_dedupe_key_unique` ON `notifications` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `idx_notifications_user_date` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `privacy_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `private_teacher_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notes_student_date` ON `private_teacher_notes` (`student_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recurring_bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`pattern` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `requests` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`booking_id` text,
	`type` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`proposals` text DEFAULT '[]' NOT NULL,
	`subject` text DEFAULT 'Mathématiques' NOT NULL,
	`duration` integer DEFAULT 60 NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`response` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "request_type" CHECK("requests"."type" in ('CUSTOM','CANCEL','MOVE')),
	CONSTRAINT "request_status" CHECK("requests"."status" in ('PENDING','PROPOSED','ACCEPTED','DECLINED'))
);
--> statement-breakpoint
CREATE INDEX `idx_requests_student` ON `requests` (`student_id`);--> statement-breakpoint
CREATE INDEX `idx_requests_status` ON `requests` (`status`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "review_rating" CHECK("reviews"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_parent_id_unique` ON `reviews` (`parent_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text NOT NULL,
	`first_name` text NOT NULL,
	`grade` text NOT NULL,
	`subject` text NOT NULL,
	`weekly_sessions` text DEFAULT '1' NOT NULL,
	`usual_duration` integer DEFAULT 60 NOT NULL,
	`objectives` text DEFAULT '' NOT NULL,
	`difficulties` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_students_parent` ON `students` (`parent_id`);--> statement-breakpoint
CREATE TABLE `transaction_guards` (
	`id` text PRIMARY KEY NOT NULL,
	`valid` integer NOT NULL,
	CONSTRAINT "OPERATION_CHANGED" CHECK("transaction_guards"."valid"=1)
);
--> statement-breakpoint
CREATE TABLE `upcoming_exams` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`date` text NOT NULL,
	`subject` text NOT NULL,
	`chapter` text NOT NULL,
	`concepts` text DEFAULT '' NOT NULL,
	`info` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_exams_student_date` ON `upcoming_exams` (`student_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_exams_date` ON `upcoming_exams` (`date`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'PARENT' NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`demo` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`last_active_at` integer NOT NULL,
	CONSTRAINT "user_role" CHECK("users"."role" in ('PARENT','ADMIN'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `waiting_list` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`status` text DEFAULT 'WAITING' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_waiting_student_slot` ON `waiting_list` (`student_id`,`starts_at`,`ends_at`);