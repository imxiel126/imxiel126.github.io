#!/usr/bin/env python3
"""Offline unit tests: WeRead API shape, safe snippets, and terms."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
import weread_enrich as e

class ReadingCardTests(unittest.TestCase):
    def test_technical_terms_match_public_text_only(self):
        book={"title":"深紫外拉曼光谱仪", "category":"科学技术-物理"}
        words, terms=e.keywords_and_terms(book,"这本书探讨拉曼光谱技术和测量不确定度。")
        self.assertIn("拉曼光谱",words)
        self.assertIn("测量不确定度",words)
        self.assertNotIn("电解水",words)
        self.assertEqual(next(t["definition"] for t in terms if t["name"]=="测量不确定度"),e.VOCAB["测量不确定度"])

    def test_long_quotation_not_republished(self):
        self.assertIsNone(e.one_short_quote([{"markText":"非常重要的知识点"*25}]))
        x=e.one_short_quote([{"markText":"只有持续的试验验证，才能知道模型在哪些条件下有效。","totalCount":21}])
        self.assertEqual(x["highlights"],21)
        self.assertLessEqual(len(x["text"]),64)

    def test_reader_review_is_public_short_only_and_nested(self):
        row={"review":{"review":{"content":"作者用真实案例解释了复杂的概念，结构清晰而且适合初学者。","star":80,"author":{"name":"读者A"}}}}
        r=e.one_public_review([row])
        self.assertEqual(r["stars"],4)
        self.assertEqual(r["author"],"读者A")
        self.assertIsNone(e.one_public_review([{"review":{"review":{"content":"长篇点评"*100}}}]))

    def test_intro_is_plain_text(self):
        self.assertEqual(e.plain("Ａ&amp;Ｂ <b>书</b> \n",30),"Ａ&Ｂ 书")

    def test_enrichment_book_info_and_quotes(self):
        book={"id":"123","title":"电解水与氢能","category":"科学技术","type":"ebook"}
        def fake_call(name, **kwargs):
            if name=="/book/info":return {"intro":"电解水制氢与氢能系统。","newRating":88,"newRatingCount":12,"publisher":"科技出版社"}
            if name=="/book/bestbookmarks":return {"items":[{"markText":"制氢效率的边界条件需要通过实际数据验证。","totalCount":16}]}
            if name=="/review/list":return {"reviews":[{"review":{"review":{"content":"体系完整，技术概念讲得清楚，非常适合工程应用的读者。","star":100,"author":{"name":"读者乙"}}}}]}
            raise AssertionError(name)
        with patch.object(e,"call",side_effect=fake_call):
            guide=e.enrich(book)
        self.assertEqual(guide["rating"],88)
        self.assertEqual(guide["review"]["stars"],5)
        self.assertTrue(guide["quote"])
        self.assertIn("电解水",guide["keywords"])

if __name__=="__main__":unittest.main()
