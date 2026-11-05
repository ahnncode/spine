-- The summary lookup got better (English editions of translated books, looser
-- title matching). Forget every "found nothing" so those books are looked up again.
delete from public.book_descriptions where description is null;
