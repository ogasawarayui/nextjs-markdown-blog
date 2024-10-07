import fs from "fs";
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import Image from "next/image";
import { NextSeo } from "next-seo";
import remarkToc from "remark-toc";
import rehypeSlug from "rehype-slug";
import remarkPrism from "remark-prism";
import React,{ createElement, Fragment } from "react";
import rehypeParse from "rehype-parse";
import rehypeReact from "rehype-react";
import Link from "next/link";
import "prismjs/themes/prism-tomorrow.css";
import remarkUnwrapImages from "remark-unwrap-images";
import { toc } from "mdast-util-toc";
import { visit } from "unist-util-visit";

const customCode = () => {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName === "p" && node.children[0].type === "text") {
        if (node.children[0].value.startsWith("[cammen]")) {
          node.tagName = "div";
          node.properties = {
            className: ["alert"],
          };
          const value = node.children[0].value.replace(/\[\/?comment\]/g, "");
          node.children = [
            {
              type: "element",
              tagName: "div",
              properties: { className: ["alert-2"] },
              children: [{ type: "text", value }],
            },
          ];
        }
      }
    });
  };
};

const getToc = (options) => {
  return (node) => {
    const result = toc(node, options);
    node.children = [result.map];
  };
};

// toReactNode関数をここで定義
const toReactNode = (html) => {
  return unified()
    .use(rehypeParse, {
      fragment: true,
    })
    .use(rehypeReact, {
      createElement,
      Fragment,
      components: {
        a: MyLink,
        img: MyImage,
      },
    })
    .processSync(html).result;
};

export async function getStaticProps({ params }) {
  const file = fs.readFileSync(`posts/${params.slug}.md`, "utf-8");
  const { data, content } = matter(file);

  const result = await unified()
    .use(remarkParse)
    .use(remarkPrism, {
      plugins: ["line-numbers"],
    })
    .use(remarkToc, {
      heading: "目次",
      tight: true,
    })
    .use(remarkUnwrapImages)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(customCode)
    .use(rehypeSlug)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(content)
    .catch((err) => {
      console.error("Error processing markdown:", err);
      throw err;
    });

  const tocResult = await unified()
    .use(remarkParse)
    .use(getToc, {
      heading: "目次",
      tight: true,
    })
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(content)
    .catch((err) => {
      console.error("Error processing TOC:", err);
      throw err;
    });

  return {
    props: {
      frontMatter: data,
      content: result.toString(),
      toc: tocResult.toString(),
      slug: params.slug,
    },
  };
}

export async function getStaticPaths() {
  const files = fs.readdirSync("posts");
  const paths = files.map((fileName) => ({
    params: {
      slug: fileName.replace(/\.md$/, ""),
    },
  }));
  return {
    paths,
    fallback: false,
  };
}

// MyImageとMyLinkを定義
const MyImage = ({ src, alt }) => {
  return (
    <div className="relative max-w-full h-96">
      <Image src={src} alt={alt} layout="fill" objectFit="contain" />
    </div>
  );
};

const MyLink = ({ children, href }) => {
  if (href === "") href = "/";
  return href.startsWith("/") || href.startsWith("#") ? (
    <Link href={href}>{children}</Link>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
};

const Post = ({ frontMatter, content, slug, toc }) => {
  return (
    <>
      <NextSeo
        title={frontMatter.title}
        description={frontMatter.description}
        openGraph={{
          type: "website",
          url: `https://localhost:3000/posts/${slug}`,
          title: frontMatter.title,
          description: frontMatter.description,
          images: [
            {
              url: `/${frontMatter.image}`,
              width: 1200,
              height: 700,
              alt: frontMatter.title,
            },
          ],
        }}
      />
      <div className="prose prose-lg max-w-none">
        <div className="border">
          <Image
            src={`/${frontMatter.image}`}
            width={1200}
            height={700}
            alt={frontMatter.title}
          />
        </div>
        <h1 className="mt-12">{frontMatter.title}</h1>
        <span>{frontMatter.date}</span>
        <div className="space-x-2">
          {frontMatter.categories && frontMatter.categories.length > 0 ? (
            frontMatter.categories.map((category) => (
              <span key={category}>
                <Link href={`/categories/${category}`}>{category}</Link>
              </span>
            ))
          ) : (
            <span>No categories available</span>
          )}
        </div>
        <div className="grid grid-cols-12">
          <div className="col-span-9">{toReactNode(content)}</div>
          <div className="col-span-3">
          <h2 className="text-xl font-bold mb-2">目次</h2>
            <div
              className="sticky top-[50px]"
              dangerouslySetInnerHTML={{ __html: toc }}
            ></div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Post;