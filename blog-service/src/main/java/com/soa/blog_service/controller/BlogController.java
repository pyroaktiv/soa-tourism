package com.soa.blog_service.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.soa.blog_service.model.Blog;
import com.soa.blog_service.model.Comment;
import com.soa.blog_service.service.BlogService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/blogs")
@RequiredArgsConstructor
public class BlogController {

    private final BlogService blogService;

    @PostMapping
    public ResponseEntity<Blog> createBlog(@RequestBody Blog blog) {
        Blog createdBlog = blogService.createBlog(blog);
        return new ResponseEntity<>(createdBlog, HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<Blog>> getAllBlogs() {
        return ResponseEntity.ok(blogService.getAllBlogs());
    }
    
    @PostMapping("/{blogId}/comments")
    public ResponseEntity<Blog> addComment(@PathVariable String blogId, @RequestBody Comment comment) {
        Blog updatedBlog = blogService.addComment(blogId, comment);
        return ResponseEntity.ok(updatedBlog);
    }
    @PostMapping("/{blogId}/toggle-like")
    public ResponseEntity<Blog> toggleLike(@PathVariable String blogId, @RequestParam String userId) {
        Blog updatedBlog = blogService.toggleLike(blogId, userId);
        return ResponseEntity.ok(updatedBlog);
    }
}