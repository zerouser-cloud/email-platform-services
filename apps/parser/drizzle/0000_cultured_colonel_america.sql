CREATE SCHEMA "parser";
--> statement-breakpoint
CREATE TABLE "parser"."parser_tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"status" varchar(50) NOT NULL,
	"category" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
