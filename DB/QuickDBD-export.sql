-- Exported from QuickDBD: https://www.quickdatabasediagrams.com/
-- NOTE! If you have used non-SQL datatypes in your design, you will have to change these here.

-- Modify this code to update the DB schema diagram.
-- To reset the sample schema, replace everything with
-- two dots ('..' - without quotes).

CREATE TABLE "sample" (
    "sample_id" int   NOT NULL,
    "region_id" int   NOT NULL,
    "pickup_date" int   NOT NULL,
    "variety_id" int   NOT NULL,
    "processing_id" int   NOT NULL,
    "test_id" int   NOT NULL,
    "state_name" string   NOT NULL,
    CONSTRAINT "pk_sample" PRIMARY KEY (
        "sample_id"
     )
);

CREATE TABLE "process_log" (
    "log_id" int   NOT NULL,
    "timestamp" int   NOT NULL,
    "state_id" int   NOT NULL,
    "sample_id" int   NOT NULL,
    "user_id" int   NOT NULL,
    CONSTRAINT "pk_process_log" PRIMARY KEY (
        "log_id"
     )
);

CREATE TABLE "mycotoxin_limit" (
    "mycotoxin_limit_id" int   NOT NULL,
    "processing_id" int   NOT NULL,
    "mycotoxin_id" int   NOT NULL,
    "limit_value" int   NOT NULL,
    CONSTRAINT "pk_mycotoxin_limit" PRIMARY KEY (
        "mycotoxin_limit_id"
     )
);

CREATE TABLE "region" (
    "region_id" int   NOT NULL,
    "region_name" string   NOT NULL,
    CONSTRAINT "pk_region" PRIMARY KEY (
        "region_id"
     )
);

CREATE TABLE "province" (
    "province_id" int   NOT NULL,
    "province_name" string   NOT NULL,
    "district_name" string   NOT NULL,
    "region_id" int   NOT NULL,
    CONSTRAINT "pk_province" PRIMARY KEY (
        "province_id"
     )
);

CREATE TABLE "variety" (
    "variety_id" int   NOT NULL,
    "variety_name" string   NOT NULL,
    CONSTRAINT "pk_variety" PRIMARY KEY (
        "variety_id"
     )
);

CREATE TABLE "processingtype" (
    "processing_id" int   NOT NULL,
    "processing_name" string   NOT NULL,
    CONSTRAINT "pk_processingtype" PRIMARY KEY (
        "processing_id"
     )
);

CREATE TABLE "test_result" (
    "test_id" int   NOT NULL,
    "test_result" string   NOT NULL,
    CONSTRAINT "pk_test_result" PRIMARY KEY (
        "test_id"
     )
);

CREATE TABLE "toxin_result" (
    "toxin_result_id" int   NOT NULL,
    "toxin_value" int   NOT NULL,
    "above_the_limit" int   NOT NULL,
    "mycotoxin_id" int   NOT NULL,
    "test_id" int   NOT NULL,
    CONSTRAINT "pk_toxin_result" PRIMARY KEY (
        "toxin_result_id"
     )
);

CREATE TABLE "mycotoxin" (
    "mycotoxin_id" int   NOT NULL,
    "toxin_name" string   NOT NULL,
    CONSTRAINT "pk_mycotoxin" PRIMARY KEY (
        "mycotoxin_id"
     )
);

ALTER TABLE "sample" ADD CONSTRAINT "fk_sample_region_id" FOREIGN KEY("region_id")
REFERENCES "region" ("region_id");

ALTER TABLE "sample" ADD CONSTRAINT "fk_sample_variety_id" FOREIGN KEY("variety_id")
REFERENCES "variety" ("variety_id");

ALTER TABLE "sample" ADD CONSTRAINT "fk_sample_processing_id" FOREIGN KEY("processing_id")
REFERENCES "processingtype" ("processing_id");

ALTER TABLE "sample" ADD CONSTRAINT "fk_sample_test_id" FOREIGN KEY("test_id")
REFERENCES "test_result" ("test_id");

ALTER TABLE "process_log" ADD CONSTRAINT "fk_process_log_state_id" FOREIGN KEY("state_id")
REFERENCES "Table 11" ("...");

ALTER TABLE "process_log" ADD CONSTRAINT "fk_process_log_sample_id" FOREIGN KEY("sample_id")
REFERENCES "sample" ("sample_id");

ALTER TABLE "process_log" ADD CONSTRAINT "fk_process_log_user_id" FOREIGN KEY("user_id")
REFERENCES "Table 12" ("...");

ALTER TABLE "mycotoxin_limit" ADD CONSTRAINT "fk_mycotoxin_limit_processing_id" FOREIGN KEY("processing_id")
REFERENCES "processingtype" ("processing_id");

ALTER TABLE "mycotoxin_limit" ADD CONSTRAINT "fk_mycotoxin_limit_mycotoxin_id" FOREIGN KEY("mycotoxin_id")
REFERENCES "mycotoxin" ("mycotoxin_id");

ALTER TABLE "province" ADD CONSTRAINT "fk_province_region_id" FOREIGN KEY("region_id")
REFERENCES "region" ("region_id");

ALTER TABLE "toxin_result" ADD CONSTRAINT "fk_toxin_result_mycotoxin_id" FOREIGN KEY("mycotoxin_id")
REFERENCES "mycotoxin" ("mycotoxin_id");

ALTER TABLE "toxin_result" ADD CONSTRAINT "fk_toxin_result_test_id" FOREIGN KEY("test_id")
REFERENCES "test_result" ("test_id");

-- Free plan table limit reached. SUBSCRIBE for more.



-- Free plan table limit reached. SUBSCRIBE for more.



