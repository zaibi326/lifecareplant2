CREATE POLICY "auth read movement photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'movement-photos');
CREATE POLICY "auth upload movement photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'movement-photos');
CREATE POLICY "auth update own movement photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'movement-photos' AND owner = auth.uid());
CREATE POLICY "auth delete own movement photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'movement-photos' AND owner = auth.uid());