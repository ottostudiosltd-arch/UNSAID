-- Official UNSAID. Campus Registry Seed Data (18 Pune Colleges)
-- Code hash formula: sha256("unsaid_college_code_v1:" || UPPER(code))

insert into public.colleges (code, name, short_name, slug, code_hash, is_active)
values
  ('06175', 'PCCOE', 'PCCOE', 'pccoe-06175', encode(extensions.digest('unsaid_college_code_v1:06175'::text, 'sha256'), 'hex'), true),
  ('06146', 'MIT Academy of Engineering', 'MIT AOE', 'mit-aoe-06146', encode(extensions.digest('unsaid_college_code_v1:06146'::text, 'sha256'), 'hex'), true),
  ('06141', 'RSCOE, Tathawade', 'RSCOE', 'rscoe-06141', encode(extensions.digest('unsaid_college_code_v1:06141'::text, 'sha256'), 'hex'), true),
  ('06139', 'Modern College of Engineering', 'Modern COE', 'modern-coe-06139', encode(extensions.digest('unsaid_college_code_v1:06139'::text, 'sha256'), 'hex'), true),
  ('06177', 'Sinhgad College of Engineering', 'SCOE', 'scoe-06177', encode(extensions.digest('unsaid_college_code_v1:06177'::text, 'sha256'), 'hex'), true),
  ('06178', 'SKN College of Engineering', 'SKNCOE', 'skncoe-06178', encode(extensions.digest('unsaid_college_code_v1:06178'::text, 'sha256'), 'hex'), true),
  ('06156', 'MMCOE', 'MMCOE', 'mmcoe-06156', encode(extensions.digest('unsaid_college_code_v1:06156'::text, 'sha256'), 'hex'), true),
  ('06155', 'G.H. Raisoni College of Engineering & Management', 'G.H. Raisoni', 'gh-raisoni-06155', encode(extensions.digest('unsaid_college_code_v1:06155'::text, 'sha256'), 'hex'), true),
  ('06145', 'JSPM''s Jaywantrao Sawant College of Engineering', 'JSPM JSCOE', 'jspm-jscoe-06145', encode(extensions.digest('unsaid_college_code_v1:06145'::text, 'sha256'), 'hex'), true),
  ('06755', 'JSPM Narhe Technical Campus', 'JSPM Narhe', 'jspm-narhe-06755', encode(extensions.digest('unsaid_college_code_v1:06755'::text, 'sha256'), 'hex'), true),
  ('06298', 'Zeal College of Engineering', 'Zeal COE', 'zeal-coe-06298', encode(extensions.digest('unsaid_college_code_v1:06298'::text, 'sha256'), 'hex'), true),
  ('06307', 'Dhole Patil College of Engineering', 'DPCOE', 'dpcoe-06307', encode(extensions.digest('unsaid_college_code_v1:06307'::text, 'sha256'), 'hex'), true),
  ('06320', 'KJ College of Engineering', 'KJCOEMR', 'kjcoe-06320', encode(extensions.digest('unsaid_college_code_v1:06320'::text, 'sha256'), 'hex'), true),
  ('06311', 'JSPM Bhivarabai Sawant Institute', 'JSPM BSIOTR', 'jspm-bsiotr-06311', encode(extensions.digest('unsaid_college_code_v1:06311'::text, 'sha256'), 'hex'), true),
  ('06203', 'MM Institute of Technology', 'MMIT', 'mmit-06203', encode(extensions.digest('unsaid_college_code_v1:06203'::text, 'sha256'), 'hex'), true),
  ('06207', 'D.Y. Patil Institute of Technology, Pimpri', 'DYPIT Pimpri', 'dypit-pimpri-06207', encode(extensions.digest('unsaid_college_code_v1:06207'::text, 'sha256'), 'hex'), true),
  ('06754', 'IIIT Pune', 'IIIT Pune', 'iiit-pune-06754', encode(extensions.digest('unsaid_college_code_v1:06754'::text, 'sha256'), 'hex'), true),
  ('06732', 'Ajeenkya DY Patil School of Engineering', 'ADYPSOE', 'adypsoe-06732', encode(extensions.digest('unsaid_college_code_v1:06732'::text, 'sha256'), 'hex'), true)
on conflict (slug) do update set
  code = excluded.code,
  name = excluded.name,
  short_name = excluded.short_name,
  code_hash = excluded.code_hash,
  is_active = excluded.is_active;
