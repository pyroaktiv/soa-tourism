package com.soa.blog_service.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import com.soa.blog_service.client.AuthGrpcClient;
import com.soa.blog_service.client.FollowerGrpcClient;
import com.soa.blog_service.security.AuthInterceptor;
import org.springframework.stereotype.Service;

import com.soa.blog_service.client.StakeholderGrpcClient;
import com.soa.blog_service.model.Blog;
import com.soa.blog_service.model.Comment;
import com.soa.blog_service.repository.BlogRepository;

import lombok.RequiredArgsConstructor;
import tourism.follower.v1.Follower;
import tourism.follower.v1.GetFollowedUserIdsResponse;
import tourism.stakeholders.v1.Profile;

@Service
@RequiredArgsConstructor
public class BlogService {

    private final BlogRepository blogRepository;
    private final StakeholderGrpcClient stakeholderClient;
    private final FollowerGrpcClient followerClient;
    private final AuthGrpcClient authClient;

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

    public List<Blog> getAllBlogs(String requesterId) {
        List<String> targetIds = new ArrayList<>(followerClient.getFollowedUserIds(requesterId).getUserIdsList());
        targetIds.add(requesterId);
        List<String> roles = AuthInterceptor.ROLES.get();

        if(roles.contains("author") || roles.contains("tourist")){
            return blogRepository.findAllByAuthorIdIn(targetIds);
        }
        else {
            return blogRepository.findAll();
        }
    }

    public String getBlogAuthorId(String blogId){
        Blog blog = blogRepository.findById(blogId).orElseThrow(() -> new RuntimeException("Blog nije pronadjen"));

        return blog.getAuthorId();
    }

    public Blog addComment(String blogId, Comment comment) {
        Blog blog = blogRepository.findById(blogId)
                .orElseThrow(() -> new RuntimeException("Blog sa ID-jem " + blogId + " nije pronađen!"));

        comment.setCreatedAt(LocalDateTime.now());
        comment.setLastModifiedAt(LocalDateTime.now());

        blog.getComments().add(comment);

        return blogRepository.save(blog);
    }
    public Blog toggleLike(String blogId, String userId) {
        Blog blog = blogRepository.findById(blogId)
                .orElseThrow(() -> new RuntimeException("Blog sa ID-jem " + blogId + " nije pronađen!"));
        if (blog.getLikedByUserIds().contains(userId)) {
            blog.getLikedByUserIds().remove(userId);
        } else {
            blog.getLikedByUserIds().add(userId);
        }
        return blogRepository.save(blog);
    }
}