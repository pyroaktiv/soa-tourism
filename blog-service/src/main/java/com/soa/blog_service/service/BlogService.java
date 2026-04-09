package com.soa.blog_service.service;

import com.soa.blog_service.client.StakeholderGrpcClient;
import com.soa.blog_service.model.Blog;
import com.soa.blog_service.model.Comment;
import com.soa.blog_service.repository.BlogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import tourism.stakeholders.v1.Profile;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BlogService {

    private final BlogRepository blogRepository;
    private final StakeholderGrpcClient stakeholderClient;

    public Blog createBlog(Blog blog) {

        try {
            Profile authorProfile = stakeholderClient.getProfile(blog.getAuthorId());
            System.out.println("Mikroservisna komunikacija uspešna!");
            System.out.println("Novi blog kreira autor: " + authorProfile.getName() + " " + authorProfile.getSurname());
            System.out.println("Njegov moto je: " + authorProfile.getMotto());

        } catch (Exception e) {
            System.out.println("Upozorenje: Nismo uspeli da nađemo profil autora. Možda Stakeholders servis nije upaljen ili ID ne postoji.");
            System.out.println("Detalji greške: " + e.getMessage());
        }

        blog.setCreationDate(LocalDateTime.now());
        return blogRepository.save(blog);
    }

    public List<Blog> getAllBlogs() {
        return blogRepository.findAll();
    }

    public Blog addComment(String blogId, Comment comment) {
        Blog blog = blogRepository.findById(blogId)
                .orElseThrow(() -> new RuntimeException("Blog sa ID-jem " + blogId + " nije pronađen!"));

        comment.setCreatedAt(LocalDateTime.now());
        comment.setLastModifiedAt(LocalDateTime.now());

        blog.getComments().add(comment);

        return blogRepository.save(blog);
    }
}