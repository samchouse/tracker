CREATE TABLE `usage` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`date` integer NOT NULL,
	`cost` integer NOT NULL,
	`service` text NOT NULL,
	`endpoint` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`username` text NOT NULL,
	`apiKey` text NOT NULL,
	`identities` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);