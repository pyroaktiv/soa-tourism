package com.soa.blog_service.controller;

import com.soa.blog_service.model.Blog;
import com.soa.blog_service.model.Comment;
import com.soa.blog_service.service.BlogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
}